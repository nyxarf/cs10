import adminService from '../services/adminService.js';
import { clusterAllFAQs, syncCanonicalCategories, getClusterStats, CANONICAL_CATEGORIES } from '../services/clusteringService.js';
import { evaluateAnswerReward } from '../services/groq.js';
import catchAsync from '../utils/catchAsync.js';

/**
 * Controller exposing moderate capabilities, direct FAQ CRUDs, user SP balance operations.
 */
class AdminController {
  /**
   * Admin login.
   */
  login = catchAsync(async (req, res) => {
    const { email, password } = req.body;
    const result = await adminService.login({ email, password });
    res.json(result);
  });

  /**
   * Get dashboard stats.
   */
  getDashboard = catchAsync(async (req, res) => {
    const result = await adminService.getDashboard();
    res.json(result);
  });

  /**
   * Get analytics metrics.
   */
  getAnalytics = catchAsync(async (req, res) => {
    const { period } = req.query;
    const result = await adminService.getAnalytics(period);
    res.json(result);
  });

  /**
   * Get query logs.
   */
  getQueryLogs = catchAsync(async (req, res) => {
    const { limit, period } = req.query;
    const result = await adminService.getQueryLogs({ limit, period });
    res.json(result);
  });

  /**
   * Get raw Groq API logs.
   */
  getGroqLogs = catchAsync(async (req, res) => {
    const { limit } = req.query;
    const result = await adminService.getGroqLogs({ limit });
    res.json(result);
  });

  /**
   * Lists all flagged community answers.
   */
  getFlaggedAnswers = catchAsync(async (req, res) => {
    const result = await adminService.getFlaggedAnswers();
    res.json(result);
  });

  /**
   * Approves a flagged answer and awards customized XP/SP amounts.
   */
  approveAnswer = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { answererXp, askerXp } = req.body;

    const result = await adminService.approveAnswer({
      id,
      answererXp,
      askerXp,
      adminId: req.user._id,
    });
    res.json(result);
  });

  /**
   * Rejects and hides a flagged answer.
   */
  rejectAnswer = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await adminService.rejectAnswer(id);
    res.json(result);
  });

  /**
   * Get pending questions
   */
  getPendingQuestions = catchAsync(async (req, res) => {
    const result = await adminService.getPendingQuestions();
    res.json(result);
  });

  /**
   * Approve a pending question
   */
  approvePendingQuestion = catchAsync(async (req, res) => {
    const { askerXp } = req.body;
    const result = await adminService.approvePendingQuestion(
      req.params.id,
      { askerXp },
      req.user._id
    );
    res.json(result);
  });

  /**
   * Reject a pending question
   */
  rejectPendingQuestion = catchAsync(async (req, res) => {
    const result = await adminService.rejectPendingQuestion(req.params.id);
    res.json(result);
  });

  /**
   * Auto-moderates all currently flagged answers using Groq AI.
   */
  autoModerateAnswers = catchAsync(async (req, res) => {
    const flaggedRes = await adminService.getFlaggedAnswers();
    const flagged = flaggedRes.data || [];
    
    let approved = 0;
    let rejected = 0;
    let totalAnswererXp = 0;

    for (const a of flagged) {
      try {
        const questionText = a.question_id?.rephrased_query || a.question_id?.original_query || '';
        const evaluation = await evaluateAnswerReward(questionText, a.content);

        if (evaluation.action === 'reject') {
          await adminService.rejectAnswer(a._id.toString());
          rejected++;
        } else {
          await adminService.approveAnswer({
            id: a._id.toString(),
            answererXp: evaluation.answererXp,
            askerXp: evaluation.askerXp,
            adminId: req.user._id,
          });
          approved++;
          totalAnswererXp += evaluation.answererXp;
        }
      } catch (err) {
        console.error(`Failed to auto-moderate answer ${a._id}:`, err);
      }
    }

    res.json({
      success: true,
      message: `Auto-moderation complete. Approved: ${approved}, Rejected: ${rejected}, Total Answerer SP awarded: ${totalAnswererXp}.`,
      stats: { approved, rejected, totalAnswererXp }
    });
  });

  /**
   * Manually promotes a community answer into the core FAQ corpus.
   */
  promoteAnswer = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { answererXp, askerXp } = req.body;

    const result = await adminService.promoteAnswer({
      id,
      answererXp,
      askerXp,
    });
    res.json(result);
  });

  /**
   * Lists all users in the system sorted by XP desc.
   */
  getUsers = catchAsync(async (req, res) => {
    const result = await adminService.getUsers();
    res.json(result);
  });

  /**
   * Adjusts a user's SP balance manually.
   */
  adjustUserSp = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { amount, reason } = req.body;
    const adminId = req.user._id;

    const result = await adminService.adjustUserSp({ id, amount, adminId, reason });
    res.json(result);
  });

  /**
   * Gets the SP Ledger.
   */
  getSpLedger = catchAsync(async (req, res) => {
    const result = await adminService.getSpLedger(req.query);
    res.json(result);
  });

  /**
   * Fetches paginated FAQ corpus items.
   */
  getFaqs = catchAsync(async (req, res) => {
    const { page } = req.query;
    const result = await adminService.getFaqs(page);
    res.json(result);
  });

  /**
   * Creates a new FAQ entry in the database (with embedding generation).
   */
  createFaq = catchAsync(async (req, res) => {
    const { question, answer, category_path } = req.body;
    const result = await adminService.createFaq({
      question,
      answer,
      category_path,
    });
    res.status(201).json(result);
  });

  /**
   * Updates an existing FAQ entry.
   */
  updateFaq = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { question, answer, category_path } = req.body;
    const result = await adminService.updateFaq(id, { question, answer, category_path });
    res.json(result);
  });

  /**
   * Permanently deletes an FAQ item.
   */
  deleteFaq = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await adminService.deleteFaq(id);
    res.json(result);
  });

  /**
   * Scan and remove all duplicate FAQ entries (keeps oldest).
   */
  deduplicateFaqs = catchAsync(async (req, res) => {
    const result = await adminService.deduplicateFaqs();
    res.json(result);
  });

  /**
   * Lists community questions for moderation views.
   */
  getQuestions = catchAsync(async (req, res) => {
    const { page, limit } = req.query;
    const result = await adminService.getQuestions({ page, limit });
    res.json(result);
  });

  /**
   * Deletes a community question and its replies.
   */
  deleteQuestion = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await adminService.deleteQuestion(id);
    res.json(result);
  });

  /**
   * Get FAQ proposals (community answers pending promotion).
   */
  getFaqProposals = catchAsync(async (req, res) => {
    const result = await adminService.getFaqProposals();
    res.json(result);
  });

  /**
   * Approve FAQ proposal.
   */
  approveFaqProposal = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { answererXp, askerXp } = req.body;
    const result = await adminService.approveFaqProposal({
      id,
      answererXp,
      askerXp,
      adminId: req.user._id,
    });
    res.json(result);
  });

  /**
   * Edit a live answer.
   */
  editAnswer = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { content, reason } = req.body;
    const editorId = req.user._id;
    
    const result = await adminService.editLiveAnswer({ answerId: id, newContent: content, editorId, reason });
    res.json(result);
  });

  /**
   * Reject FAQ proposal.
   */
  rejectFaqProposal = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await adminService.rejectFaqProposal(id);
    res.json(result);
  });

  /**
   * Get the edit history of a live answer.
   */
  getAnswerHistory = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await adminService.getAnswerHistory(id);
    res.json(result);
  });

  /**
   * Trigger HNSW-based FAQ semantic clustering.
   * Re-assigns all (or uncategorized) FAQs to the 14 canonical categories
   * using cosine similarity against category centroid embeddings.
   */
  clusterFAQs = catchAsync(async (req, res) => {
    const { scope = 'all', dryRun = false } = req.body;
    const result = await clusterAllFAQs({ scope, dryRun });
    res.json(result);
  });

  /**
   * Sync the 14 canonical categories to MongoDB (create or update).
   */
  syncCategories = catchAsync(async (req, res) => {
    const results = await syncCanonicalCategories();
    res.json({ success: true, results });
  });

  /**
   * Get per-category FAQ counts (current clustering stats).
   */
  getClusterStats = catchAsync(async (req, res) => {
    const stats = await getClusterStats();
    const categories = CANONICAL_CATEGORIES.map(c => ({
      id: c.id,
      label: c.label,
      path: c.path,
      description: c.description,
    }));
    res.json({ stats, categories });
  });

  /**
   * Trigger Global AI Cluster (Groq-based, for master FAQ generation).
   */
  globalAiCluster = catchAsync(async (req, res) => {
    const { apiKey } = req.body;
    const result = await adminService.globalAiCluster(apiKey);
    res.json(result);
  });

  /**
   * Create Master FAQ from AI Cluster proposal
   */
  createMasterFaq = catchAsync(async (req, res) => {
    const { masterQuestion, masterAnswer, category, questionIds, tags } = req.body;
    const result = await adminService.createMasterFaq({ masterQuestion, masterAnswer, category, questionIds, tags });
    res.status(201).json(result);
  });

  /**
   * Get all spotlighted questions (open, unanswered, 2+ minutes old).
   */
  getSpotlightedQuestions = catchAsync(async (req, res) => {
    const { page, limit } = req.query;
    const result = await adminService.getSpotlightedQuestions({ page, limit });
    res.json(result);
  });
}

export default new AdminController();
