import questionService from '../services/questionService.js';
import catchAsync from '../utils/catchAsync.js';
import { validateCategory, checkQuestionSimilarity, checkQuestionRelevance } from '../services/groq.js';
import { sanitizeQuestion } from '../utils/questionSanitizer.js';
import Question from '../models/Question.js';
import FAQ from '../models/FAQ.js';
import { getEmbedding } from '../services/embeddingService.js';
import logger from '../utils/logger.js';

/**
 * Controller mapping all community question postings, listings, detail lookups, and voting.
 */
class QuestionController {
  /**
   * Rephrases and categorizes user search query prior to community posting.
   */
  prepareQuestion = catchAsync(async (req, res) => {
    const { query } = req.body;
    const result = await questionService.prepare(query);
    res.json(result);
  });

  /**
   * Submits a community question with proper DB-based category path.
   */
  submitQuestion = catchAsync(async (req, res) => {
    const { original_query, rephrased_query, category, category_path, category_label } = req.body;
    const userId = req.user._id;

    const result = await questionService.submit({
      original_query,
      rephrased_query,
      category,
      category_path,
      category_label,
      userId,
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.json(result);
    }
  });

  /**
   * Lists all community questions using query filter & sorting parameters.
   */
  listQuestions = catchAsync(async (req, res) => {
    const { category, category_path, status, page, sort, limit, search } = req.query;
    const result = await questionService.list({
      category,
      category_path,
      status,
      page,
      sort,
      limit,
      search,
    });
    res.json(result);
  });

  /**
   * Retrieves detail information for a single question along with its replies.
   */
  getQuestion = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await questionService.get(id);
    res.json(result);
  });

  /**
   * Records a user's vote on a community question.
   */
  voteQuestion = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { type } = req.body;
    const userId = req.user._id;

    const result = await questionService.vote({ id, type, userId });
    res.json(result);
  });
  /**
   * Tracks user engagement time on a question page.
   */
  trackEngagement = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { timeSeconds } = req.body;
    
    // We only track valid time chunks (e.g. 5 seconds)
    if (timeSeconds > 0 && timeSeconds < 300) {
      await questionService.addEngagementTime(id, timeSeconds);
    }
    res.json({ success: true });
  });

  /**
   * Tracks when a question is clicked from a search result.
   */
  trackSearchHit = catchAsync(async (req, res) => {
    const { id } = req.params;
    await questionService.addSearchHit(id);
    res.json({ success: true });
  });
  /**
   * Validates if a question matches the chosen category
   */
  validateCategoryMatch = catchAsync(async (req, res) => {
    const { question, category } = req.body;
    if (!question || !category) {
      return res.status(400).json({ error: 'Question and category required' });
    }
    const result = await validateCategory(question, category);
    res.json(result);
  });

  /**
   * Reports a question as irrelevant/spam.
   * If a question reaches 3 reports, hide it automatically.
   */
  reportQuestion = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.reports.includes(userId)) {
      return res.status(400).json({ error: 'You have already reported this question' });
    }

    question.reports.push(userId);
    
    // Auto-hide threshold logic
    if (question.reports.length >= 3 && question.status !== 'hidden') {
      question.status = 'hidden';
    }

    await question.save();
    res.json({ success: true, message: 'Question reported successfully' });
  });

  /**
   * Public leaderboard — returns top users ranked by XP/SP with community stats.
   * Supports period filtering: all | 7d | 30d
   */
  getLeaderboard = catchAsync(async (req, res) => {
    const User = (await import('../models/User.js')).default;
    const Answer = (await import('../models/Answer.js')).default;

    const { period = 'all', limit = 50 } = req.query;
    const limitNum = Math.min(50, parseInt(limit) || 50);

    // Build date filter for period-based SP (approximated via ledger or just sort by xp)
    // For now: sort all-time by xp. Future: use SPLedger for period filtering.
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('name xp answers_count questions_count role created_at')
      .sort({ xp: -1 })
      .limit(limitNum)
      .lean();

    // Add streak placeholder (can be computed from SPLedger in future)
    const enriched = users.map((u, i) => ({
      ...u,
      streak: Math.max(0, Math.floor(u.answers_count / 3)),   // placeholder
      rankChange: 0,  // placeholder for real rank-change tracking
    }));

    // Aggregate global stats
    const [totalUsers, totalAnswers, totalQuestions, spAgg] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      Answer.countDocuments({ status: 'live' }),
      Question.countDocuments({ status: { $in: ['open', 'answered'] } }),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$xp' } } }]),
    ]);

    res.json({
      users: enriched,
      stats: {
        totalUsers,
        totalAnswers,
        totalQuestions,
        totalSp: spAgg[0]?.total || 0,
      },
      period,
    });
  });

  /**
   * Two-layer question validation pipeline.
   *
   * POST /api/questions/validate
   * Body: { question: string }
   * Auth: none required (public — called before submit)
   *
   * Layer 1 — Pure regex (zero API calls):
   *   • Strips / rejects greetings (hi, hello, HHHEEEllow, …)
   *   • Rejects elongated gibberish, filler words, all-caps, emoji-only
   *   • Returns cleaned text if valid
   *
   * Layer 2 — Groq semantic similarity (API call):
   *   • Embeds the cleaned question
   *   • Fetches top-5 similar FAQs via vector search
   *   • Fetches top-5 similar community questions via vector search
   *   • Passes all candidates to Groq for semantic dedup
   *   • Returns the best match (with answer) if similar enough
   *
   * Response shape:
   * {
   *   valid: boolean,          // false → show `reason` to user, block submit
   *   cleaned?: string,        // sanitized question (use this for submission)
   *   reason?: string,         // human-readable rejection reason
   *   similar?: {
   *     question: string,
   *     answer: string | null,
   *     source: 'faq' | 'community',
   *     id: string | null,
   *     reason: string,
   *   }
   * }
   */
  validateQuestion = catchAsync(async (req, res) => {
    const { question } = req.body;

    // ── Layer 1: Pure regex sanitization (no API cost) ──────────────────────
    const sanitized = sanitizeQuestion(question);
    if (!sanitized.valid) {
      logger.debug('Validate', `Layer 1 rejected: "${question?.slice(0, 60)}" — ${sanitized.reason}`);
      return res.json({ valid: false, reason: sanitized.reason });
    }

    const cleaned = sanitized.cleaned;
    logger.debug('Validate', `Layer 1 passed. Cleaned: "${cleaned.slice(0, 80)}"`);

    // ── Layer 1.5: Groq relevance gate ──────────────────────────────────
    // Checks if the question is actually related to the internship platform.
    // Catches things like "I love you", jokes, trivia, chit-chat, etc.
    // Fail-open: if Groq is down the question still proceeds to Layer 2.
    const relevanceResult = await checkQuestionRelevance(cleaned);
    if (!relevanceResult.relevant) {
      logger.info('Validate', `Layer 1.5 off-topic: "${cleaned.slice(0, 60)}" — ${relevanceResult.reason}`);
      return res.json({
        valid: false,
        reason: relevanceResult.reason
          || 'Your question does not appear to be related to the internship program. Please ask something about eligibility, certificates, ViBe, NOC, timelines, or other internship topics.',
      });
    }
    logger.debug('Validate', `Layer 1.5 passed (relevant).`);

    // ── Layer 2: Groq semantic similarity (API call) ─────────────────────────
    try {
      const embedding = await getEmbedding(cleaned);

      // Fetch top candidates from FAQ corpus
      const faqCandidates = await FAQ.aggregate([
        {
          $vectorSearch: {
            index: 'faq_vector_index',
            path: 'embedding',
            queryVector: embedding,
            numCandidates: 20,
            limit: 5,
          },
        },
        {
          $project: {
            question: 1,
            answer: 1,
            score: { $meta: 'searchScore' },
          },
        },
        { $match: { score: { $gte: 0.70 } } },
      ]).catch(() => []);

      // Fetch top candidates from community questions
      const communityCandidates = await Question.find({
        rephrased_query: { $regex: cleaned.split(' ').slice(0, 4).join('|'), $options: 'i' },
        status: { $ne: 'hidden' },
      })
        .select('rephrased_query')
        .limit(5)
        .lean()
        .catch(() => []);

      // Build unified candidate list
      const candidates = [
        ...faqCandidates.map((f) => ({
          question: f.question,
          answer: f.answer,
          source: 'faq',
          id: f._id?.toString(),
        })),
        ...communityCandidates.map((q) => ({
          question: q.rephrased_query,
          answer: null,
          source: 'community',
          id: q._id?.toString(),
        })),
      ];

      if (candidates.length === 0) {
        return res.json({ valid: true, cleaned });
      }

      // Ask Groq: is this a duplicate?
      const similarityResult = await checkQuestionSimilarity(cleaned, candidates);

      if (similarityResult.isSimilar) {
        logger.info('Validate', `Layer 2 duplicate detected for: "${cleaned.slice(0, 60)}"`);
        return res.json({
          valid: true,       // still valid — user CAN post, but we warn them
          cleaned,
          similar: {
            ...similarityResult.match,
            reason: similarityResult.reason,
          },
        });
      }

      return res.json({ valid: true, cleaned });

    } catch (err) {
      // Layer 2 failure is non-fatal — allow submission to proceed
      logger.warn('Validate', `Layer 2 check failed (non-fatal): ${err.message}`);
      return res.json({ valid: true, cleaned });
    }
  });
}

export default new QuestionController();
