/**
 * Question routes
 *
 * IMPORTANT: All static path routes must be declared BEFORE parameterised
 * routes (/:id, /:id/vote, etc.) to prevent Express from matching static
 * segments as IDs.
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import questionController from '../controllers/questionController.js';

const router = Router();

/* ─── Static routes (must come before /:id) ──────────────────────────────── */

/**
 * Two-layer question validation:
 *  Layer 1 — regex/pattern (no API cost): greetings, gibberish, elongation, filler
 *  Layer 2 — Groq semantic similarity: checks FAQ corpus + community board
 */
router.post('/validate', questionController.validateQuestion);

/**
 * Rephrase and categorize a query for community posting
 */
router.post('/prepare', questionController.prepareQuestion);

/**
 * Post a question to the community board
 */
router.post('/submit', authMiddleware, questionController.submitQuestion);

/**
 * Validate if a question matches a chosen category
 */
router.post('/validate-category', questionController.validateCategoryMatch);

/**
 * Public leaderboard — top users by SP/XP
 */
router.get('/leaderboard/top', questionController.getLeaderboard);

/**
 * Browse community questions (paginated)
 */
router.get('/', questionController.listQuestions);

/* ─── Parameterised routes (/:id must come last) ─────────────────────────── */

/**
 * Get single question with its answers
 */
router.get('/:id', questionController.getQuestion);

/**
 * Vote on a question
 */
router.post('/:id/vote', authMiddleware, questionController.voteQuestion);

/**
 * Track user engagement time (dwelling on page)
 */
router.post('/:id/engage', questionController.trackEngagement);

/**
 * Track search frequency
 */
router.post('/:id/search-hit', questionController.trackSearchHit);

/**
 * Report a question as irrelevant/spam
 */
router.post('/:id/report', authMiddleware, questionController.reportQuestion);

export default router;
