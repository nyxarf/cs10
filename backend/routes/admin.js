/**
 * Admin routes
 */

import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import adminController from '../controllers/adminController.js';

const router = Router();

// Admin login route (public)
router.post('/login', adminController.login);

// All other admin routes require auth + admin role
router.use(authMiddleware);
router.use(adminMiddleware);

/* ─────────────────────────────────────────────
   Dashboard & Analytics
   ───────────────────────────────────────────── */

router.get('/dashboard', adminController.getDashboard);
router.get('/analytics', adminController.getAnalytics);
router.get('/query-logs', adminController.getQueryLogs);
router.get('/groq-logs', adminController.getGroqLogs);

/* ─────────────────────────────────────────────
   Flagged answer review
   ───────────────────────────────────────────── */

/**
 * Get all flagged answers for review (with asker + answerer info)
 */
router.get('/flagged', adminController.getFlaggedAnswers);
router.get('/moderation', adminController.getFlaggedAnswers);

/**
 * Auto-moderate all flagged answers using Groq
 * MUST be before /moderation/:id routes to avoid id='auto-moderate' conflict
 */
router.post('/moderation/auto-moderate', adminController.autoModerateAnswers);

/**
 * Pending Questions moderation
 * MUST be before /moderation/:id routes
 */
router.get('/moderation/questions', adminController.getPendingQuestions);
router.post('/moderation/questions/:id/approve', adminController.approvePendingQuestion);
router.post('/moderation/questions/:id/reject', adminController.rejectPendingQuestion);

/**
 * Approve a flagged answer + award custom SP to answerer and asker
 */
router.post('/answers/:id/approve', adminController.approveAnswer);
router.post('/moderation/:id/approve', adminController.approveAnswer);

/**
 * Reject a flagged answer permanently
 */
router.post('/answers/:id/reject', adminController.rejectAnswer);
router.post('/moderation/:id/reject', adminController.rejectAnswer);

/**
 * Promote a community answer directly into the FAQ corpus
 */
router.post('/answers/:id/promote', adminController.promoteAnswer);

/**
 * Edit a live answer
 */
router.put('/answers/:id/edit', adminController.editAnswer);

/**
 * Get answer edit history
 */
router.get('/answers/:id/history', adminController.getAnswerHistory);

/* ─────────────────────────────────────────────
   FAQ Proposals
   ───────────────────────────────────────────── */

router.get('/faq-proposals', adminController.getFaqProposals);
router.post('/faq-proposals/:id/approve', adminController.approveFaqProposal);
router.post('/faq-proposals/:id/reject', adminController.rejectFaqProposal);

/* ─────────────────────────────────────────────
   User SP management
   ───────────────────────────────────────────── */

/**
 * List all users (name, email, role, xp) sorted by xp desc
 */
router.get('/users', adminController.getUsers);

/**
 * Manually adjust a user's SP
 */
router.post('/users/:id/sp', adminController.adjustUserSp);

/**
 * Get the SP Ledger (Transaction log)
 */
router.get('/sp-ledger', adminController.getSpLedger);

/* ─────────────────────────────────────────────
   FAQ management (CRUD)
   ───────────────────────────────────────────── */

/**
 * List all FAQs for admin view (paginated, 50 per page)
 */
router.get('/faqs', adminController.getFaqs);

/**
 * Create a new FAQ entry with live embedding generation
 */
router.post('/faqs', adminController.createFaq);
router.post('/faqs/deduplicate', adminController.deduplicateFaqs);

/**
 * Permanently delete an FAQ entry from the corpus
 */
router.delete('/faqs/:id', adminController.deleteFaq);

/**
 * Update an FAQ entry
 */
router.put('/faqs/:id', adminController.updateFaq);

/**
 * Toggle pin state of an FAQ
 */
router.patch('/faqs/:id/pin', adminController.pinFaq);

/* ─────────────────────────────────────────────
   Community question management
   ───────────────────────────────────────────── */

/**
 * List all community questions (paginated, newest first)
 */
router.get('/questions', adminController.getQuestions);
router.get('/community/questions', adminController.getQuestions);

/**
 * Change status of a community question (open / review / hidden / closed)
 */
router.patch('/questions/:id/status', adminController.updateQuestionStatus);
router.patch('/community/questions/:id/status', adminController.updateQuestionStatus);

/**
 * Toggle pin state of a community question
 */
router.patch('/questions/:id/pin', adminController.pinQuestion);
router.patch('/community/questions/:id/pin', adminController.pinQuestion);

/**
 * Get all community answers (paginated, with status filter)
 */
router.get('/answers', adminController.getAnswers);

/**
 * Change status of a community answer (live / flagged / hidden)
 */
router.patch('/answers/:id/status', adminController.updateAnswerStatus);

/**
 * Permanently delete a community question and all its associated answers
 */
router.delete('/questions/:id', adminController.deleteQuestion);
router.delete('/community/questions/:id', adminController.deleteQuestion);

/* ─────────────────────────────────────────────
   HNSW FAQ Semantic Clustering
   ───────────────────────────────────────────── */

/**
 * GET /api/admin/cluster/stats
 * Returns per-category FAQ counts and canonical category list.
 */
router.get('/cluster/stats', adminController.getClusterStats);

/**
 * POST /api/admin/cluster/sync
 * Create/update the 14 canonical category documents in MongoDB.
 */
router.post('/cluster/sync', adminController.syncCategories);

/**
 * POST /api/admin/cluster/run
 * Run HNSW clustering on the FAQ corpus.
 * Body: { scope: 'all' | 'uncategorized', dryRun: boolean }
 */
router.post('/cluster/run', adminController.clusterFAQs);

/* ─────────────────────────────────────────────
   Global AI Cluster (Groq-based)
   ───────────────────────────────────────────── */

router.post('/community/global-ai-cluster', adminController.globalAiCluster);
router.post('/community/create-master-faq', adminController.createMasterFaq);

/* ─────────────────────────────────────────────
   Community Spotlight
   ───────────────────────────────────────────── */

/**
 * GET /api/admin/spotlight
 * Returns paginated open, unanswered questions that are older than 2 minutes.
 */
router.get('/spotlight', adminController.getSpotlightedQuestions);

export default router;
