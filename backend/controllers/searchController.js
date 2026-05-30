import { runYakshaPipeline } from '../services/yaksha.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

/**
 * Controller orchestrating semantic searches using Yaksha pipeline.
 */
class SearchController {
  /**
   * Invokes full Yaksha hybrid vector search and synthesis pipeline.
   */
  ask = catchAsync(async (req, res) => {
    const { query, history = [] } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 8) {
      throw new AppError('Please provide a valid query (at least 8 characters).', 400);
    }

    console.log(`🔍 Yaksha search pipeline: "${query.substring(0, 80)}..." (History turns: ${history.length})`);

    const result = await runYakshaPipeline(query.trim(), history);
    res.json(result);
  });
  /**
   * Submit helpful/unhelpful feedback on a cached Yaksha response.
   */
  feedback = catchAsync(async (req, res) => {
    const { cacheId, helpful } = req.body;
    if (!cacheId) return res.json({ success: true }); // No cache to update

    // We can just log it or update the semantic cache entry
    try {
      const SemanticCache = (await import('../models/SemanticCache.js')).default;
      const sentiment = helpful ? 'positive' : 'negative';
      await SemanticCache.findByIdAndUpdate(cacheId, { sentiment });
    } catch (e) {
      console.error('Feedback failed:', e.message);
    }
    res.json({ success: true });
  });
}

export default new SearchController();
