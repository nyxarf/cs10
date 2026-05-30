import Answer from '../models/Answer.js';
import Question from '../models/Question.js';
import FAQ from '../models/FAQ.js';
import FAQCategory from '../models/FAQCategory.js';
import User from '../models/User.js';
import SemanticCache from '../models/SemanticCache.js';
import { getEmbedding } from './embeddingService.js';
import AppError from '../utils/appError.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import SPLedger from '../models/SPLedger.js';

const generateFingerprint = (text) => crypto.createHash('sha256').update(text.toLowerCase().trim()).digest('hex');

/**
 * Service managing all administrative and moderation capabilities.
 */
class AdminService {
  /**
   * Admin login
   */
  async login({ email, password }) {
    if (!email || !password) throw new AppError('Email and password are required.', 400);

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.role !== 'admin') {
      throw new AppError('Invalid admin credentials.', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new AppError('Invalid admin credentials.', 401);

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    return {
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Get dashboard stats.
   */
  async getDashboard() {
    const SPOTLIGHT_THRESHOLD_MS = 2 * 60 * 1000;
    const spotlightCutoff = new Date(Date.now() - SPOTLIGHT_THRESHOLD_MS);

    const faqCount = await FAQ.countDocuments();
    const categoryCount = await FAQCategory.countDocuments();
    const userCount = await User.countDocuments();
    const communityQueryCount = await Question.countDocuments();
    const pendingModeration = await Answer.countDocuments({ status: 'flagged' });
    const pendingFaqProposals = await Answer.countDocuments({
      status: 'live',
      promoted_to_corpus: { $ne: true },
      net_score: { $gte: 3 }
    });
    const spotlightedCount = await Question.countDocuments({
      status: 'open',
      answer_count: 0,
      created_at: { $lt: spotlightCutoff },
    });
    const recentLogs = await SemanticCache.find().sort({ created_at: -1 }).limit(10).lean();

    return {
      faqCount,
      categoryCount,
      userCount,
      communityQueryCount,
      pendingModeration,
      pendingFaqProposals,
      spotlightedCount,
      recentLogs,
    };
  }

  /**
   * Get analytics.
   */
  async getAnalytics(period = '7d') {
    const GroqLog = (await import('../models/GroqLog.js')).default;

    const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // ── 1. Total counts ────────────────────────────────────────────────
    const [totalQueries, totalQuestions, totalAnswers, totalFaqs, totalUsers] = await Promise.all([
      SemanticCache.countDocuments(),
      Question.countDocuments(),
      Answer.countDocuments({ status: 'live' }),
      FAQ.countDocuments(),
      User.countDocuments(),
    ]);

    // ── 2. Daily query volume (SemanticCache hits per day) ─────────────
    const dailyVolume = await SemanticCache.aggregate([
      { $match: { created_at: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
          queries: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // ── 3. Daily community questions posted ────────────────────────────
    const dailyCommunity = await Question.aggregate([
      { $match: { created_at: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
          questions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Merge into unified time series
    const dateMap = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dateMap[key] = { date: key, queries: 0, questions: 0 };
    }
    dailyVolume.forEach(r => { if (dateMap[r._id]) dateMap[r._id].queries = r.queries; });
    dailyCommunity.forEach(r => { if (dateMap[r._id]) dateMap[r._id].questions = r.questions; });
    const timeSeries = Object.values(dateMap);

    // ── 4. Category distribution (real Questions data) ─────────────────
    const categoryDistribution = await Question.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // ── 5. Answer status breakdown ─────────────────────────────────────
    const answerStatusBreakdown = await Answer.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // ── 6. Question status breakdown ───────────────────────────────────
    const questionStatusBreakdown = await Question.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // ── 7. Top SP earners ──────────────────────────────────────────────
    const topEarners = await User.find()
      .select('name role xp answers_count questions_count')
      .sort({ xp: -1 })
      .limit(8)
      .lean();

    // ── 8. User role distribution ──────────────────────────────────────
    const userRoleDistribution = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    // ── 9. Sentiment breakdown from SemanticCache ──────────────────────
    const sentimentBreakdown = await SemanticCache.aggregate([
      { $group: { _id: '$sentiment', count: { $sum: 1 } } },
    ]);

    // ── 10. Groq token usage summary ──────────────────────────────────
    const groqTokenStats = await GroqLog.aggregate([
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$tokens_total' },
          totalPromptTokens: { $sum: '$tokens_prompt' },
          totalCompletionTokens: { $sum: '$tokens_completion' },
          totalCalls: { $sum: 1 },
        },
      },
    ]);
    const groqDailyTokens = await GroqLog.aggregate([
      { $match: { created_at: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
          tokens: { $sum: '$tokens_total' },
          calls: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // ── 11. Promoted answers ───────────────────────────────────────────
    const promotedCount = await Answer.countDocuments({ promoted_to_corpus: true });
    const avgScore = await Answer.aggregate([
      { $match: { status: 'live' } },
      { $group: { _id: null, avg: { $avg: '$net_score' } } },
    ]);

    return {
      // Totals
      totalQueries,
      totalQuestions,
      totalAnswers,
      totalFaqs,
      totalUsers,
      promotedCount,
      avgAnswerScore: avgScore[0]?.avg?.toFixed(2) ?? 0,
      avgConfidence: 0.85,

      // Time series
      timeSeries,
      groqDailyTokens,

      // Distributions
      categoryDistribution,
      answerStatusBreakdown,
      questionStatusBreakdown,
      sentimentBreakdown,
      userRoleDistribution,
      topEarners,

      // Groq stats
      groqStats: groqTokenStats[0] || { totalTokens: 0, totalCalls: 0 },

      // Legacy compat
      actionDistribution: {
        answer:  sentimentBreakdown.find(s => s._id !== 'negative')?.count ?? 0,
        clarify: sentimentBreakdown.find(s => s._id === 'negative')?.count ?? 0,
      },
    };
  }

  /**
   * Get query logs.
   */
  async getQueryLogs({ limit = 100, period = '7d' }) {
    const limitNum = Math.min(100, parseInt(limit) || 100);
    const logs = await SemanticCache.find().sort({ created_at: -1 }).limit(limitNum).lean();
    
    const formattedLogs = logs.map(l => ({
      _id: l._id,
      originalQuery: l.original_query,
      category: 'general', // Mock category
      actionTaken: l.sentiment === 'negative' ? 'clarify' : 'answer',
      confidence: l.sentiment === 'positive' ? 0.95 : (l.sentiment === 'neutral' ? 0.80 : 0.40),
      createdAt: l.created_at,
    }));

    return { items: formattedLogs };
  }

  /**
   * Get raw Groq API logs.
   */
  async getGroqLogs({ limit = 100 }) {
    const GroqLog = (await import('../models/GroqLog.js')).default;
    const limitNum = Math.min(200, parseInt(limit) || 100);
    const logs = await GroqLog.find().sort({ created_at: -1 }).limit(limitNum).lean();
    return { data: logs, total: logs.length };
  }

  /**
   * List all flagged answers pending review.
   * Sorted by upvotes as primary signal, then by creation time.
   *
   * @returns {Promise<{data: Array, total: number}>} Flagged answers and count
   */
  async getFlaggedAnswers() {
    const flaggedAnswers = await Answer.find({ status: 'flagged' })
      .populate('answered_by', 'name email xp')
      .populate({
        path: 'question_id',
        select: 'rephrased_query original_query category posted_by',
        populate: { path: 'posted_by', select: 'name email xp' },
      })
      .sort({ upvotes: -1, created_at: 1 })
      .lean();

    return {
      data: flaggedAnswers,
      total: flaggedAnswers.length,
    };
  }

  /**
   * Approve a flagged answer and award custom XP/SP to answerer and asker.
   *
   * @param {Object} params - Admin approval parameters
   * @param {string} params.id - Answer ID
   * @param {number} params.answererXp - SP to award to the answer writer
   * @param {number} params.askerXp - SP to award to the question asker
   * @param {string} [params.adminId] - Admin performing the action (for ledger)
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async approveAnswer({ id, answererXp = 15, askerXp = 10, adminId }) {
    const answer = await Answer.findById(id);
    if (!answer) throw new AppError('Answer not found.', 404);
    if (answer.status !== 'flagged') throw new AppError('This answer is not flagged.', 400);

    await Answer.findByIdAndUpdate(answer._id, { status: 'live', ai_check_passed: true });

    // Award SP to answerer with ledger entry
    if (Number(answererXp) !== 0) {
      const answerer = await User.findById(answer.answered_by);
      if (answerer) {
        const oldBalance = answerer.xp;
        const newXp = Math.max(0, answerer.xp + Number(answererXp));
        await User.findByIdAndUpdate(answerer._id, { xp: newXp });
        if (adminId) {
          await SPLedger.create({
            user_id: answerer._id,
            admin_id: adminId,
            amount: Number(answererXp),
            reason: 'Answer approved by admin',
            old_balance: oldBalance,
            new_balance: newXp,
          });
        }
      }
    }

    const question = await Question.findById(answer.question_id);
    if (question && question.posted_by.toString() !== answer.answered_by.toString() && Number(askerXp) !== 0) {
      const asker = await User.findById(question.posted_by);
      if (asker) {
        const oldBalance = asker.xp;
        const newXp = Math.max(0, asker.xp + Number(askerXp));
        await User.findByIdAndUpdate(asker._id, { xp: newXp });
        if (adminId) {
          await SPLedger.create({
            user_id: asker._id,
            admin_id: adminId,
            amount: Number(askerXp),
            reason: 'Question answered — asker SP reward',
            old_balance: oldBalance,
            new_balance: newXp,
          });
        }
      }
    }

    return {
      success: true,
      message: `Answer approved. Awarded ${answererXp} SP to answerer${question ? ` and ${askerXp} SP to asker` : ''}.`,
    };
  }

  /**
   * Reject and permanently hide a flagged answer.
   *
   * @param {string} id - Answer ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async rejectAnswer(id) {
    const answer = await Answer.findById(id);
    if (!answer) throw new AppError('Answer not found.', 404);
    if (answer.status !== 'flagged') throw new AppError('This answer is not flagged.', 400);

    await Answer.findByIdAndUpdate(answer._id, { status: 'hidden' });

    return { message: 'Answer permanently rejected and hidden.' };
  }

  /**
   * List all questions pending review.
   */
  async getPendingQuestions() {
    const pendingQuestions = await Question.find({ status: 'review' })
      .populate('posted_by', 'name email xp')
      .sort({ created_at: 1 })
      .lean();

    return { data: pendingQuestions, total: pendingQuestions.length };
  }

  /**
   * Approve a pending question
   */
  async approvePendingQuestion(questionId, { askerXp = 15 } = {}, adminId) {
    const question = await Question.findById(questionId).populate('posted_by');
    if (!question) throw new AppError('Question not found.', 404);
    if (question.status !== 'review') throw new AppError(`Question status is ${question.status}, cannot approve.`, 400);

    question.status = 'open';
    await question.save();

    // Reward the asker
    if (askerXp > 0 && question.posted_by) {
      await User.findByIdAndUpdate(question.posted_by._id, { $inc: { xp: askerXp } });
      await SPLedger.create({
        user: question.posted_by._id,
        amount: askerXp,
        reason: 'Question approved from moderation queue',
        admin: adminId,
        referenceModel: 'Question',
        referenceId: question._id
      });
    }

    return { message: 'Question approved and set to open.', question };
  }

  /**
   * Reject a pending question
   */
  async rejectPendingQuestion(questionId) {
    const question = await Question.findById(questionId);
    if (!question) throw new AppError('Question not found.', 404);
    if (question.status !== 'review') throw new AppError(`Question status is ${question.status}, cannot reject.`, 400);

    question.status = 'hidden';
    await question.save();

    return { message: 'Question rejected and hidden.' };
  }

  /**
   * Get the edit history of a specific answer.
   *
   * @param {string} answerId - Answer ID
   * @returns {Promise<{answer: Object, history: Array}>}
   */
  async getAnswerHistory(answerId) {
    const answer = await Answer.findById(answerId)
      .populate('answered_by', 'name email')
      .populate('question_id', 'rephrased_query')
      .lean();
    if (!answer) throw new AppError('Answer not found.', 404);

    const history = (answer.edit_history || []).map(h => ({
      edited_by: h.edited_by,
      previous_content: h.previous_content,
      reason: h.reason,
      edited_at: h.edited_at,
    }));

    return {
      answer: {
        _id: answer._id,
        content: answer.content,
        status: answer.status,
        answered_by: answer.answered_by,
        question_id: answer.question_id,
        created_at: answer.created_at,
        edit_count: history.length,
      },
      history,
    };
  }

  /**
   * Manually promote a community answer directly to the FAQ corpus.
   * Generates live embedding vectors and awards XP/SP.
   * Handles already-promoted answers by updating the existing FAQ record.
   * Performs duplicate checking before promotion.
   *
   * @param {Object} params - Promotion inputs
   * @param {string} params.id - Answer ID
   * @param {number} params.answererXp - SP to award to the answer writer
   * @param {number} params.askerXp - SP to award to the question asker
   * @returns {Promise<{success: boolean, message: string, faq_category: string, action: string}>}
   */
  async promoteAnswer({ id, answererXp = 25, askerXp = 15 }) {
    const answer = await Answer.findById(id)
      .populate('answered_by', 'name')
      .lean();
    if (!answer) throw new AppError('Answer not found.', 404);

    const question = await Question.findById(answer.question_id)
      .populate('posted_by', 'name')
      .lean();
    if (!question) throw new AppError('Associated question not found.', 404);

    // Map community question categories to canonical 14-category paths
    const categoryMap = {
      about:        'root.about_the_internship',
      timing:       'root.timeline',
      noc:          'root.noc',
      selection:    'root.about_the_internship',
      work:         'root.projects',
      conduct:      'root.policies',
      certificate:  'root.certificate',
      interviews:   'root.about_the_internship',
      general:      'root.general',
      teams:        'root.teams',
      projects:     'root.projects',
      vibe:         'root.vibe',
      offer:        'root.offer_letter',
      yaksha:       'root.yaksha',
      support:      'root.support_channels',
      completion:   'root.completion',
      policies:     'root.policies',
      mentor:       'root.mentor',
      timeline:     'root.timeline',
    };
    const categoryPath = categoryMap[question.category] || 'root.general';

    const fingerprint = generateFingerprint(question.rephrased_query);

    // Check for existing FAQ with this fingerprint
    const existingFaq = await FAQ.findOne({ fingerprint });
    if (existingFaq) {
      // If this answer is already linked to an FAQ, just refresh it
      if (answer.promoted_to_corpus && answer.promoted_faq_id?.toString() === existingFaq._id.toString()) {
        const combinedText = `${question.rephrased_query} ${answer.content}`;
        let embedding;
        try {
          embedding = await getEmbedding(combinedText.substring(0, 512));
        } catch (embErr) {
          embedding = new Array(384).fill(0.0);
        }
        existingFaq.answer = answer.content;
        existingFaq.embedding = embedding;
        existingFaq.category_path = categoryPath;
        existingFaq.source = 'community';
        await existingFaq.save();
        return {
          success: true,
          message: 'FAQ record refreshed with latest answer content.',
          faq_category: categoryPath,
          action: 'refreshed',
        };
      }
      // Different answer trying to promote to same question -> block
      throw new AppError(
        `This question already has an FAQ in the corpus: "${existingFaq.question.substring(0, 80)}...". Please update that FAQ instead or edit the answer to be significantly different.`,
        409
      );
    }

    // Semantic similarity check before creating
    try {
      const queryEmbedding = await getEmbedding(question.rephrased_query);
      const simCheck = await FAQ.aggregate([
        {
          $vectorSearch: {
            index: 'faq_vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 20,
            limit: 5
          }
        },
        {
          $project: {
            question: 1,
            answer: 1,
            category_path: 1,
            similarity: { $meta: 'searchScore' }
          }
        }
      ]);

      const similarFaq = simCheck.find(r => r.similarity >= 0.92);
      if (similarFaq) {
        throw new AppError(
          `A semantically similar FAQ already exists: "${similarFaq.question.substring(0, 80)}..." (${Math.round(similarFaq.similarity * 100)}% match). Cannot promote a near-duplicate.`,
          409
        );
      }
    } catch (semanticError) {
      if (semanticError.statusCode === 409) throw semanticError;
      console.error('⚠️ Semantic dedup check failed during promotion:', semanticError.message);
    }

    const combinedText = `${question.rephrased_query} ${answer.content}`;
    let embedding;
    try {
      embedding = await getEmbedding(combinedText.substring(0, 512));
    } catch (embErr) {
      console.error('⚠️ Embedding generation failed during promotion, using zero fallback:', embErr.message);
      embedding = new Array(384).fill(0.0);
    }

    const faq = await FAQ.findOneAndUpdate(
      { fingerprint },
      {
        category_path: categoryPath,
        question: question.rephrased_query,
        answer: answer.content,
        fingerprint,
        embedding,
        source: 'community',
      },
      { upsert: true, new: true }
    );

    const answerIdStr = answer._id;
    await Answer.findByIdAndUpdate(answerIdStr, {
      status: 'live',
      ai_check_passed: true,
      promoted_to_corpus: true,
      promoted_faq_id: faq._id,
    });

    await User.findByIdAndUpdate(answer.answered_by._id || answer.answered_by, {
      $inc: { xp: Number(answererXp) },
    });

    if (question.posted_by && question.posted_by._id?.toString() !== answer.answered_by._id?.toString()) {
      await User.findByIdAndUpdate(question.posted_by._id || question.posted_by, {
        $inc: { xp: Number(askerXp) },
      });
    }

    return {
      success: true,
      message: `Answer promoted to FAQ corpus! Awarded ${answererXp} SP to answerer and ${askerXp} SP to asker.`,
      faq_category: categoryPath,
      action: 'created',
    };
  }

  /**
   * Fetch a list of all users sorted by XP.
   *
   * @returns {Promise<{data: Array, total: number}>}
   */
  async getUsers() {
    const users = await User.find()
      .select('name email role xp answers_count questions_count created_at')
      .sort({ xp: -1 })
      .lean();

    return { data: users, total: users.length };
  }

  /**
   * Manually adjust a user's SP balance (preventing it from dropping below zero).
   *
   * @param {Object} params - SP adjustment inputs
   * @param {string} params.id - User ID
   * @param {number} params.amount - Positive to add, negative to deduct
   * @returns {Promise<{success: boolean, message: string, xp: number}>}
   */
  async adjustUserSp({ id, amount, adminId, reason = 'Manual Adjustment' }) {
    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      throw new AppError('amount is required and must be a number.', 400);
    }
    if (!adminId) throw new AppError('Admin ID is required.', 400);

    const delta = Math.round(Number(amount));
    const user = await User.findById(id);
    if (!user) throw new AppError('User not found.', 404);

    const oldBalance = user.xp;
    const newXp = Math.max(0, user.xp + delta);
    
    await User.findByIdAndUpdate(user._id, { xp: newXp });

    await SPLedger.create({
      user_id: user._id,
      admin_id: adminId,
      amount: delta,
      reason,
      old_balance: oldBalance,
      new_balance: newXp
    });

    const action = delta >= 0 ? `Awarded +${delta}` : `Deducted ${Math.abs(delta)}`;
    return {
      success: true,
      message: `${action} SP to ${user.name}. New balance: ${newXp} SP.`,
      xp: newXp,
    };
  }

  /**
   * Fetch SP Ledger (Transaction log) with filtering.
   *
   * @param {Object} filters - Filtering options
   * @param {string} [filters.userId] - Filter by user
   * @param {string} [filters.adminId] - Filter by admin who made change
   * @param {string} [filters.fromDate] - Start date (ISO string)
   * @param {string} [filters.toDate] - End date (ISO string)
   * @param {number} [filters.page] - Page number
   * @param {number} [filters.limit] - Results per page
   */
  async getSpLedger(filters = {}) {
    const query = {};
    if (filters.userId) query.user_id = filters.userId;
    if (filters.adminId) query.admin_id = filters.adminId;
    if (filters.fromDate || filters.toDate) {
      query.created_at = {};
      if (filters.fromDate) query.created_at.$gte = new Date(filters.fromDate);
      if (filters.toDate) query.created_at.$lte = new Date(filters.toDate);
    }

    const pageNum = Math.max(1, parseInt(filters.page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(filters.limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [ledger, total] = await Promise.all([
      SPLedger.find(query)
        .populate('user_id', 'name email')
        .populate('admin_id', 'name email')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SPLedger.countDocuments(query),
    ]);

    const items = ledger.map(l => ({
      _id: l._id,
      user: l.user_id,
      admin: l.admin_id,
      amount: l.amount,
      reason: l.reason,
      old_balance: l.old_balance,
      new_balance: l.new_balance,
      created_at: l.created_at,
    }));

    return {
      data: items,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    };
  }

  /**
   * List all FAQ corpus items paginated.
   *
   * @param {number} page - Page number
   * @returns {Promise<{data: Array, total: number, page: number, pages: number}>}
   */
  async getFaqs(page = 1) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limit = 50;
    const skip = (pageNum - 1) * limit;

    const [faqs, total] = await Promise.all([
      FAQ.find()
        .select('category_path question answer source created_at')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FAQ.countDocuments(),
    ]);

    return { data: faqs, total, page: pageNum, pages: Math.ceil(total / limit) };
  }

  /**
   * Create a new FAQ entry manually with generated vector embeddings.
   * Uses upsert semantics: if a duplicate fingerprint OR semantically similar
   * question exists, update the existing entry rather than creating a new one.
   *
   * @param {Object} params - FAQ entry inputs
   * @param {string} params.question - FAQ question
   * @param {string} params.answer - FAQ answer
   * @param {string} params.category_path - Section category path (e.g. root.noc)
   * @returns {Promise<{success: boolean, message: string, faq_id: string, action: string}>}
   */
  async createFaq({ question, answer, category_path }) {
    if (!question || !answer || !category_path) {
      throw new AppError('question, answer, and category_path are required.', 400);
    }

    const normalizedQuestion = question.trim();
    const normalizedAnswer = answer.trim();
    const normalizedCategoryPath = category_path.trim();

    const fingerprint = generateFingerprint(normalizedQuestion);

    // 1. Exact fingerprint match -> upsert existing
    const existingFingerprint = await FAQ.findOne({ fingerprint });
    if (existingFingerprint) {
      existingFingerprint.answer = normalizedAnswer;
      existingFingerprint.category_path = normalizedCategoryPath;
      try {
        existingFingerprint.embedding = await getEmbedding(`${normalizedQuestion} ${normalizedAnswer}`.substring(0, 512));
      } catch (embErr) {
        console.error('⚠️ Embedding failed during FAQ update:', embErr.message);
      }
      await existingFingerprint.save();
      return {
        success: true,
        message: 'FAQ updated (duplicate detected via fingerprint).',
        faq_id: existingFingerprint._id,
        action: 'updated',
      };
    }

    // 2. Semantic similarity check (avoid creating near-duplicates)
    try {
      const queryEmbedding = await getEmbedding(normalizedQuestion);
      const simCheck = await FAQ.aggregate([
        {
          $vectorSearch: {
            index: 'faq_vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 20,
            limit: 5
          }
        },
        {
          $project: {
            question: 1,
            answer: 1,
            category_path: 1,
            similarity: { $meta: 'searchScore' }
          }
        }
      ]);

      const similarFaq = simCheck.find(r => r.similarity >= 0.92);
      if (similarFaq) {
        throw new AppError(
          `A semantically similar FAQ already exists: "${similarFaq.question.substring(0, 80)}..." (${Math.round(similarFaq.similarity * 100)}% match). Please update that entry instead or edit the question to be more distinct.`,
          409
        );
      }
    } catch (semanticError) {
      if (semanticError.statusCode === 409) throw semanticError;
      console.error('⚠️ Semantic dedup check failed:', semanticError.message);
    }

    let embedding;
    try {
      embedding = await getEmbedding(`${normalizedQuestion} ${normalizedAnswer}`.substring(0, 512));
    } catch (embErr) {
      console.error('⚠️ Embedding failed for manual FAQ creation, using zero fallback:', embErr.message);
      embedding = new Array(384).fill(0.0);
    }

    const faq = await FAQ.create({
      question: normalizedQuestion,
      answer: normalizedAnswer,
      category_path: normalizedCategoryPath,
      fingerprint,
      embedding,
      source: 'manual',
    });

    return {
      success: true,
      message: 'FAQ created successfully.',
      faq_id: faq._id,
      action: 'created',
    };
  }

  /**
   * Updates an existing FAQ entry.
   *
   * @param {string} id - FAQ entry ID
   * @param {Object} params - FAQ entry inputs
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async updateFaq(id, { question, answer, category_path }) {
    const faq = await FAQ.findById(id);
    if (!faq) throw new AppError('FAQ not found.', 404);

    // If the question is being changed, check for duplicates first
    if (question && question.trim() !== faq.question) {
      const newFingerprint = generateFingerprint(question.trim());
      const clash = await FAQ.findOne({ fingerprint: newFingerprint, _id: { $ne: faq._id } });
      if (clash) {
        throw new AppError(
          `Duplicate detected: An FAQ with this question already exists ("${clash.question.substring(0, 80)}...").`,
          409
        );
      }
      faq.fingerprint = newFingerprint;
      faq.question = question.trim();
    }

    if (question || answer) {
      const q = faq.question;
      const a = answer ? answer.trim() : faq.answer;
      try {
        const embedding = await getEmbedding(`${q} ${a}`.substring(0, 512));
        faq.embedding = embedding;
      } catch (embErr) {
        console.error('⚠️ Embedding failed for manual FAQ update:', embErr.message);
      }
    }

    if (answer) faq.answer = answer.trim();
    if (category_path) faq.category_path = category_path.trim();

    await faq.save();

    return {
      success: true,
      message: 'FAQ updated successfully.',
    };
  }

  /**
   * Scan the entire FAQ corpus for duplicates (same fingerprint) and remove them.
   * Keeps the oldest entry in each group.
   *
   * @returns {Promise<{success: boolean, removed: number, message: string}>}
   */
  async deduplicateFaqs() {
    const allFaqs = await FAQ.find().select('_id question fingerprint created_at').sort({ created_at: 1 }).lean();

    const seen = new Map();       // fingerprint -> first FAQ _id
    const toDelete = [];          // _id array of duplicates
    const noFingerprint = [];     // FAQs missing fingerprint — compute & check

    for (const faq of allFaqs) {
      const fp = faq.fingerprint || generateFingerprint(faq.question);

      if (!faq.fingerprint) {
        noFingerprint.push({ id: faq._id, fp });
      }

      if (seen.has(fp)) {
        toDelete.push(faq._id);
      } else {
        seen.set(fp, faq._id);
      }
    }

    // Backfill missing fingerprints (skip ones about to be deleted)
    for (const { id, fp } of noFingerprint) {
      const isBeingDeleted = toDelete.some(d => d.toString() === id.toString());
      if (!isBeingDeleted) {
        await FAQ.updateOne({ _id: id }, { $set: { fingerprint: fp } });
      }
    }

    // Delete duplicates
    if (toDelete.length > 0) {
      await FAQ.deleteMany({ _id: { $in: toDelete } });
    }

    return {
      success: true,
      removed: toDelete.length,
      message: toDelete.length === 0
        ? 'No duplicates found. Knowledge base is clean!'
        : `Removed ${toDelete.length} duplicate FAQ(s). Knowledge base cleaned.`,
    };
  }

  /**
   * Delete an FAQ entry from the corpus.
   *
   * @param {string} id - FAQ entry ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async deleteFaq(id) {
    const faq = await FAQ.findByIdAndDelete(id);
    if (!faq) throw new AppError('FAQ not found.', 404);

    return { success: true, message: 'FAQ deleted successfully.' };
  }

  /**
   * Fetch all community questions (paginated) for admin operations.
   * Sorted by recency to show new questions at the top.
   *
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Limit per page
   * @returns {Promise<{data: Array, total: number, page: number, pages: number}>}
   */
  async getQuestions({ page = 1, limit = 30 } = {}) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 30));
    const skip = (pageNum - 1) * limitNum;

    const [questions, total] = await Promise.all([
      Question.find()
        .populate('posted_by', 'name email')
        .select('rephrased_query original_query category status answer_count net_score upvotes created_at posted_by')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Question.countDocuments(),
    ]);

    return { data: questions, total, page: pageNum, pages: Math.ceil(total / limitNum) };
  }

  /**
   * Permanently delete a community question and all linked answers.
   *
   * @param {string} id - Question ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async deleteQuestion(id) {
    const question = await Question.findById(id);
    if (!question) throw new AppError('Question not found.', 404);

    const { deletedCount } = await Answer.deleteMany({ question_id: question._id });
    await Question.findByIdAndDelete(question._id);

    return {
      success: true,
      message: `Question and ${deletedCount} associated answer(s) deleted.`,
    };
  }

  /**
   * Get FAQ proposals (community answers with good upvotes not yet promoted).
   * Sorted by upvotes/net_score first as primary ranking signal.
   */
  async getFaqProposals() {
    const proposals = await Answer.find({ status: 'live', promoted_to_corpus: { $ne: true } })
      .sort({ net_score: -1, upvotes: -1, created_at: -1 })
      .limit(50)
      .populate('answered_by', 'name email xp')
      .populate({
        path: 'question_id',
        select: 'rephrased_query original_query category posted_by',
        populate: { path: 'posted_by', select: 'name email xp' },
      })
      .lean();

    return {
      data: proposals,
      total: proposals.length,
    };
  }

  /**
   * Approve an FAQ proposal: approve as live, then promote to FAQ corpus.
   * Writes SP to ledger for both answerer and asker.
   */
  async approveFaqProposal({ id, answererXp = 25, askerXp = 15, adminId }) {
    const answer = await Answer.findById(id);
    if (!answer) throw new AppError('Answer not found.', 404);
    if (answer.promoted_to_corpus) throw new AppError('This answer is already promoted.', 400);

    if (answer.status === 'flagged') {
      await Answer.findByIdAndUpdate(answer._id, { status: 'live', ai_check_passed: true });
    }

    const result = await this.promoteAnswer({ id, answererXp, askerXp });
    return result;
  }

  /**
   * Reject an FAQ proposal — just return success (the answer stays live, it just won't be promoted).
   */
  async rejectFaqProposal(id) {
    const answer = await Answer.findById(id);
    if (!answer) throw new AppError('Answer not found.', 404);
    return { success: true, message: 'Proposal rejected.' };
  }

  /**
   * Edit a live answer and update its related FAQ if it has been promoted.
   */
  async editLiveAnswer({ answerId, newContent, editorId, reason }) {
    if (!newContent || newContent.trim().length < 20) {
      throw new AppError('Answer must be at least 20 characters.', 400);
    }

    const answer = await Answer.findById(answerId).populate('question_id');
    if (!answer) throw new AppError('Answer not found.', 404);
    if (answer.status !== 'live') throw new AppError('Only live answers can be edited.', 400);

    // AI Check
    const { checkAnswer } = await import('./groq.js');
    const aiResult = await checkAnswer(answer.question_id.rephrased_query, newContent.trim());
    
    if (!aiResult.passes) {
      throw new AppError('Edited content failed AI safety/relevance checks.', 400);
    }

    // Save previous content to history
    answer.edit_history.push({
      edited_by: editorId,
      previous_content: answer.content,
      reason: reason || 'Admin edit',
    });

    answer.content = newContent.trim();
    await answer.save();

    // If it was promoted, update the FAQ too
    if (answer.promoted_to_corpus && answer.promoted_faq_id) {
      const faq = await FAQ.findById(answer.promoted_faq_id);
      if (faq) {
        faq.answer = answer.content;
        try {
          faq.embedding = await getEmbedding(`${faq.question} ${faq.answer}`.substring(0, 512));
        } catch (e) {
          console.error('Embedding update failed during answer edit:', e);
        }
        await faq.save();
      }
    }

    return { success: true, message: 'Answer edited successfully.' };
  }

  /**
   * Trigger Global AI Cluster.
   */
  async globalAiCluster(customApiKey) {
    // 1. Fetch recent questions (with their answers) that are not yet promoted
    const questions = await Question.find({ answer_count: { $gt: 0 } })
      .sort({ net_score: -1, created_at: -1 })
      .limit(10) // Reduced to 10 to strictly avoid Groq's 6000 TPM limit
      .lean();

    if (questions.length === 0) {
      return { success: true, message: 'No answered questions available to cluster.', proposals: [] };
    }

    const questionIds = questions.map(q => q._id);
    const answers = await Answer.find({ question_id: { $in: questionIds }, status: 'live' })
      .sort({ net_score: -1 })
      .lean();

    // Map questions to their best answer, truncating answers heavily to save tokens
    const questionsData = questions.map(q => {
      const bestAnswer = answers.find(a => a.question_id.toString() === q._id.toString());
      return {
        id: q._id.toString(),
        q: q.rephrased_query || q.original_query,
        c: q.category,
        a: bestAnswer ? bestAnswer.content.substring(0, 300) + '...' : 'N/A' // Truncate to 300 chars
      };
    }).filter(q => q.a !== 'N/A');

    // 2. Call Groq AI to cluster them
    const { clusterQuestions } = await import('./groq.js');
    const result = await clusterQuestions(questionsData, customApiKey);
    
    if (!result.proposals || result.proposals.length === 0) {
       return { success: false, message: 'AI clustering failed to return results. Please try again.', proposals: [] };
    }

    // 3. Post-process to attach original question strings for the UI
    const proposals = result.proposals.map(prop => ({
      ...prop,
      originalQuestions: (prop.questionIds || []).map(id => {
        const qData = questionsData.find(qd => qd.id === id);
        return qData ? { id, question: qData.q } : { id, question: 'Unknown' };
      }).filter(q => q.question !== 'Unknown')
    }));

    return { success: true, message: 'AI clustering completed successfully.', proposals };
  }

  /**
   * Save a Master FAQ generated from AI Clustering and mark original community questions as promoted.
   */
  async createMasterFaq({ masterQuestion, masterAnswer, category, questionIds, tags }) {
    if (!masterQuestion || !masterAnswer) {
      throw new AppError('masterQuestion and masterAnswer are required.', 400);
    }

    // Map from Groq category names to canonical 14-category paths
    const categoryMap = {
      about:        'root.about_the_internship',
      timing:       'root.timeline',
      noc:          'root.noc',
      selection:    'root.about_the_internship',
      work:         'root.projects',
      conduct:      'root.policies',
      certificate:  'root.certificate',
      interviews:   'root.about_the_internship',
      general:      'root.general',
      teams:        'root.teams',
      projects:     'root.projects',
      vibe:         'root.vibe',
      offer:        'root.offer_letter',
      yaksha:       'root.yaksha',
      support:      'root.support_channels',
      completion:   'root.completion',
      policies:     'root.policies',
      mentor:       'root.mentor',
      timeline:     'root.timeline',
      rossettA:     'root.rosetta',
    };
    const categoryPath = categoryMap[category?.toLowerCase()] || 'root.general';

    let embedding;
    try {
      embedding = await getEmbedding(`${masterQuestion} ${masterAnswer}`.substring(0, 512));
    } catch (embErr) {
      console.error('⚠️ Embedding failed for Master FAQ creation, using zero fallback:', embErr.message);
      embedding = new Array(384).fill(0.0);
    }

    const fingerprint = generateFingerprint(masterQuestion);

    const faq = await FAQ.findOneAndUpdate(
      { fingerprint },
      {
        question: masterQuestion.trim(),
        answer: masterAnswer.trim(),
        category_path: categoryPath,
        fingerprint,
        embedding,
        source: 'ai_master',
      },
      { upsert: true, new: true }
    );

    if (questionIds && questionIds.length > 0) {
      // Mark these answers as promoted
      await Answer.updateMany(
        { question_id: { $in: questionIds }, status: 'live' },
        { promoted_to_corpus: true, promoted_faq_id: faq._id }
      );
    }

    return {
      success: true,
      message: 'Master FAQ successfully added to Knowledge Base.',
      faq_id: faq._id,
    };
  }

  /**
   * Get all spotlighted questions (open, unanswered, older than 2 minutes).
   * Sorted newest-first within the spotlight criteria.
   *
   * @param {Object} options
   * @param {number} [options.page=1]   - Page number
   * @param {number} [options.limit=20] - Results per page
   * @returns {Promise<{data: Array, total: number, page: number, pages: number}>}
   */
  async getSpotlightedQuestions({ page = 1, limit = 20 } = {}) {
    const SPOTLIGHT_THRESHOLD_MS = 2 * 60 * 1000;
    const spotlightCutoff = new Date(Date.now() - SPOTLIGHT_THRESHOLD_MS);
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      status: 'open',
      answer_count: 0,
      created_at: { $lt: spotlightCutoff },
    };

    const [questions, total] = await Promise.all([
      Question.find(filter)
        .populate('posted_by', 'name email xp')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Question.countDocuments(filter),
    ]);

    return {
      data: questions.map((q) => ({ ...q, is_spotlighted: true })),
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    };
  }
}

export default new AdminService();
