/**
 * Question routes
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import questionController from '../controllers/questionController.js';

const router = Router();

/**
 * Rephrase and categorize a query for community posting
 */
router.post('/prepare', questionController.prepareQuestion);

/**
 * Post a question to the community board
 */
router.post('/submit', authMiddleware, questionController.submitQuestion);

/**
 * Browse community questions (paginated)
 */
router.get('/', questionController.listQuestions);

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
 * Validate Category
 */
router.post('/validate-category', questionController.validateCategoryMatch);

/**
 * Report a question
 */
router.post('/:id/report', authMiddleware, questionController.reportQuestion);

export default router;
