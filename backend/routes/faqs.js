import { Router } from 'express';
import { createRateLimiter } from '../config/rateLimiter.js';
import faqController from '../controllers/faqController.js';

const router = Router();

const faqRateLimit = createRateLimiter({
  max: 30,
});

/**
 * GET /api/faqs
 * Returns all FAQs grouped by section.
 */
router.get('/', faqRateLimit, faqController.listFaqs);

/**
 * GET /api/faqs/sections
 * Returns list of sections with counts.
 */
router.get('/sections', faqRateLimit, faqController.listSections);

/**
 * GET /api/faqs/mindmap?section=<sectionId>
 * Generates a Groq-powered mind map tree for a FAQ section.
 */
router.get('/mindmap', faqRateLimit, faqController.getMindMap);

export default router;

