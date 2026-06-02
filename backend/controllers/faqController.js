import faqService from '../services/faqService.js';
import catchAsync from '../utils/catchAsync.js';
import { generateMindMap } from '../services/groq.js';
import logger from '../utils/logger.js';

/** Simple in-process cache: sectionId → { data, expiresAt } */
const mindMapCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Controller handling user-facing FAQ queries.
 */
class FAQController {
  /**
   * Retrieves all FAQs, with optional category/search filters, grouped by section.
   */
  listFaqs = catchAsync(async (req, res) => {
    const { section, search } = req.query;
    const result = await faqService.listFaqs({ section, search });
    res.json(result);
  });

  /**
   * Retrieves FAQ sections count metadata.
   */
  listSections = catchAsync(async (req, res) => {
    const result = await faqService.listSections();
    res.json(result);
  });

  /**
   * Generates a hierarchical mind map for a given FAQ section via Groq.
   * Results are cached for 10 minutes per section to reduce API calls.
   *
   * GET /api/faqs/mindmap?section=<sectionId>
   *
   * Note: We intentionally fetch ALL FAQs (no section filter) and then extract
   * the target section from the grouped result. This is necessary because
   * `listFaqs({ section })` uses a regex built from the raw sectionId (e.g. 'about'),
   * which does NOT match the actual category path ('root.about_the_internship').
   * The grouping logic in faqService correctly maps those paths → sectionIds.
   */
  getMindMap = catchAsync(async (req, res) => {
    const { section } = req.query;
    if (!section) {
      return res.status(400).json({ error: 'section query parameter is required.' });
    }

    // Serve from cache if still fresh
    const cached = mindMapCache.get(section);
    if (cached && cached.expiresAt > Date.now()) {
      logger.debug('MindMap', `Cache hit for section: ${section}`);
      return res.json({ ...cached.data, cached: true });
    }

    // Fetch all FAQs and extract the target section from the grouped result.
    // listFaqs() with no filter returns every section, keyed by canonical sectionId.
    const faqResult = await faqService.listFaqs({});
    const sectionData = faqResult.sections?.[section];

    if (!sectionData || !sectionData.faqs?.length) {
      logger.warn('MindMap', `No FAQs found for section: ${section}`);
      return res.status(404).json({ error: `No FAQs found for section: ${section}` });
    }

    const sectionLabel = sectionData.label || section;
    const faqs = sectionData.faqs;

    logger.info('MindMap', `Generating mind map for "${sectionLabel}" (${faqs.length} FAQs)`);

    // Generate mind map via Groq
    const mindMap = await generateMindMap(sectionLabel, faqs);

    // Cache the result
    mindMapCache.set(section, {
      data: mindMap,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    logger.success('MindMap', `Mind map generated for section: ${sectionLabel}`);
    res.json(mindMap);
  });
}

export default new FAQController();
