/**
 * Yaksha AI search route
 */

import { Router } from 'express';
import { createRateLimiter } from '../config/rateLimiter.js';
import searchController from '../controllers/searchController.js';

const router = Router();

const searchRateLimit = createRateLimiter({
  max: 10,
});

// Chat endpoint (multi-turn logic managed by frontend passing history)
router.post('/ask', searchController.ask);

// Feedback endpoint
router.post('/feedback', searchController.feedback);

export default router;
