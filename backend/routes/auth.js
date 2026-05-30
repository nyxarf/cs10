/**
 * Auth routes: register + login + profile
 */

import { Router } from 'express';
import authController from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/register
 * Create a new user account
 */
router.post('/register', authController.register);

/**
 * POST /api/auth/login
 * Authenticate and return JWT
 */
router.post('/login', authController.login);

/**
 * GET /api/auth/me
 * Returns the logged-in user's profile, their questions, and their answers.
 */
router.get('/me', authMiddleware, authController.getProfile);

export default router;
