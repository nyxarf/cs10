import questionService from '../services/questionService.js';
import catchAsync from '../utils/catchAsync.js';
import { validateCategory } from '../services/groq.js';
import Question from '../models/Question.js';

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
   * Submits a community question (checks for semantic duplicates).
   */
  submitQuestion = catchAsync(async (req, res) => {
    const { original_query, rephrased_query, category } = req.body;
    const userId = req.user._id;

    const result = await questionService.submit({
      original_query,
      rephrased_query,
      category,
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
    const { category, status, page, sort, limit } = req.query;
    const result = await questionService.list({
      category,
      status,
      page,
      sort,
      limit,
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
}

export default new QuestionController();
