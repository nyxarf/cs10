/**
 * HNSW-based FAQ Clustering Service
 *
 * Uses MongoDB Atlas Vector Search (HNSW index) for ANN queries to
 * cluster FAQs into the 14 predefined categories based on semantic
 * similarity of (question + answer) embeddings against category centroids.
 *
 * Categories are matched via cosine similarity against pre-computed
 * category description embeddings.
 */

import FAQ from '../models/FAQ.js';
import FAQCategory from '../models/FAQCategory.js';
import { getEmbedding } from './embeddingService.js';
import logger from '../utils/logger.js';

// ─── Category Definitions ────────────────────────────────────────────────────
// These are the 14 canonical FAQ categories.
export const CANONICAL_CATEGORIES = [
  {
    id: 'about',
    path: 'root.about_the_internship',
    label: 'About the Internship',
    keywords: ['about', 'internship', 'vins', 'vise', 'vled', 'eligibility', 'selection', 'paid', 'unpaid', 'stipend', 'program', 'cohort', 'duration', 'opt in', 'process'],
    description: 'General questions about the VINS/VISE internship program, eligibility, selection process, and program details.',
  },
  {
    id: 'noc',
    path: 'root.noc',
    label: 'NOC',
    keywords: ['noc', 'no objection', 'certificate', 'sign', 'hod', 'college', 'submit', 'upload', 'verification'],
    description: 'Questions about No Objection Certificates — who can sign, format, submission, and verification.',
  },
  {
    id: 'certificate',
    path: 'root.certificate',
    label: 'Certificate',
    keywords: ['certificate', 'certification', 'e-certificate', 'download', 'academic credit', 'university', 'unpaid', 'digitally signed', 'resume', 'IIT Ropar'],
    description: 'Questions about internship certificates, e-certificate download, university credit transfer, and resume usage.',
  },
  {
    id: 'rosetta',
    path: 'root.rosetta',
    label: 'Rosetta',
    keywords: ['rosetta', 'journal', 'daily log', 'thinking routine', 'entry', 'document', 'chatgpt', 'ai', 'submit'],
    description: 'Questions about the Rosetta daily journal, thinking routines, AI usage policy, and submission.',
  },
  {
    id: 'teams',
    path: 'root.teams',
    label: 'Teams',
    keywords: ['team', 'teammate', 'member', 'whatsapp', 'group', 'form team', 'change team', 'inactive', 'drop out', '4 person'],
    description: 'Questions about team formation, team size, changing teammates, WhatsApp groups, and member conflicts.',
  },
  {
    id: 'projects',
    path: 'root.projects',
    label: 'Projects',
    keywords: ['project', 'open source', 'mentor', 'phase 2', 'phase 3', 'phase 4', 'bronze', 'silver', 'gold', 'platinum', 'assignment'],
    description: 'Questions about Phase 2-4 projects, project assignment, open source work, mentor guidance, and milestone tiers.',
  },
  {
    id: 'vibe',
    path: 'root.vibe',
    label: 'ViBe platform',
    keywords: ['vibe', 'vi be', 'video', 'platform', 'coursework', 'mern', 'bypass', 'exam', 'quiet helper', 'pause', 'dns', 'enrolled', 'error'],
    description: 'Questions about the ViBe learning platform, video issues, bypass exam, coursework, and technical troubleshooting.',
  },
  {
    id: 'offer',
    path: 'root.offer_letter',
    label: 'Offer letter',
    keywords: ['offer', 'offer letter', 'accept', 'acceptance', 'subject line', 'paraphrase', 'appeal', 'withdrawn', 'deadline', 'defer', 'change date'],
    description: 'Questions about offer letter acceptance, correct phrasing, appeals, deferring dates, and deadline to respond.',
  },
  {
    id: 'yaksha',
    path: 'root.yaksha',
    label: 'Yaksha',
    keywords: ['yaksha', 'chat', 'chatbox', 'ask', 'question', 'tag', 'escalate', 'support'],
    description: 'Questions about the Yaksha AI chatbot, how to ask questions, tags, and escalation to human support.',
  },
  {
    id: 'support',
    path: 'root.support_channels',
    label: 'Support channels',
    keywords: ['support', 'help', 'whatsapp', 'email', 'contact', 'phone', 'escalate', 'issue', 'troubleshoot', 'no-reply', 'tpo', 'response time'],
    description: 'Questions about how to reach support, WhatsApp groups, email addresses, response time, and TPO contact.',
  },
  {
    id: 'completion',
    path: 'root.completion',
    label: 'Completion',
    keywords: ['completion', 'complete', 'finish', 'drop out', 'terminate', 'phase 2 complete', 'end', 'submit journal'],
    description: 'Questions about completing the internship, dropping out mid-way, Phase 2 completion, and final submissions.',
  },
  {
    id: 'policies',
    path: 'root.policies',
    label: 'Policies',
    keywords: ['policy', 'rules', 'attendance', 'mandatory', 'live session', 'leave', 'exam', 'termination', 'attendance', 'expected hours', 'weekend'],
    description: 'Questions about internship policies, attendance, leave, mandatory sessions, working hours, and termination rules.',
  },
  {
    id: 'mentor',
    path: 'root.mentor',
    label: 'Mentor',
    keywords: ['mentor', 'assigned', 'contact', 'weekend', 'guidance', 'phase 1', 'support', 'find mentor'],
    description: 'Questions about mentor assignment, how to contact the mentor, and mentor responsibilities in each phase.',
  },
  {
    id: 'timeline',
    path: 'root.timeline',
    label: 'Timeline',
    keywords: ['timeline', 'deadline', 'start date', 'end date', 'kickoff', 'orientation', 'zoom', 'latest end date', '2 months', 'grace period', 'when does it start'],
    description: 'Questions about the internship timeline, start/end dates, kickoff orientation, Zoom link, and absolute deadlines.',
  },
];

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Find the best matching category for a given text using embedding similarity
 * against pre-computed category description embeddings.
 *
 * @param {string} text - Combined question + answer text
 * @param {Map<string, number[]>} categoryEmbeddings - Map of category id → embedding
 * @param {number} threshold - Minimum similarity threshold (default 0.35)
 * @returns {{ categoryId: string, categoryLabel: string, similarity: number }}
 */
export function findBestCategoryForText(text, categoryEmbeddings, threshold = 0.35) {
  const textEmbedding = getEmbeddingSync(text);
  let bestCategoryId = 'timeline'; // fallback
  let bestSimilarity = -1;

  for (const [catId, embedding] of categoryEmbeddings) {
    const sim = cosineSimilarity(textEmbedding, embedding);
    if (sim > bestSimilarity) {
      bestSimilarity = sim;
      bestCategoryId = catId;
    }
  }

  const cat = CANONICAL_CATEGORIES.find(c => c.id === bestCategoryId);
  return {
    categoryId: bestCategoryId,
    categoryLabel: cat?.label || bestCategoryId,
    categoryPath: cat?.path || `root.${bestCategoryId}`,
    similarity: bestSimilarity,
    belowThreshold: bestSimilarity < threshold,
  };
}

/**
 * Synchronous embedding generation (used in-memory only — call after pre-loading model).
 * This is a thin wrapper that awaits since the actual extractor is async.
 */
async function getEmbeddingSync(text) {
  const { getEmbedding } = await import('./embeddingService.js');
  return getEmbedding(text);
}

/**
 * Pre-compute and cache category description embeddings.
 * Each category is embedded using its description + keywords concatenated.
 */
let _categoryEmbeddingCache = null;

export async function getCategoryEmbeddings() {
  if (_categoryEmbeddingCache) return _categoryEmbeddingCache;

  const cache = new Map();
  logger.info('Clustering', `Computing embeddings for ${CANONICAL_CATEGORIES.length} category centroids...`);

  await Promise.all(
    CANONICAL_CATEGORIES.map(async (cat) => {
      const fullText = `${cat.description} ${cat.keywords.join(' ')}`;
      const embedding = await getEmbedding(fullText);
      cache.set(cat.id, embedding);
    })
  );

  _categoryEmbeddingCache = cache;
  logger.success('Clustering', 'Category centroid embeddings computed and cached.');
  return cache;
}

/**
 * Clear the category embedding cache (useful when model reloads).
 */
export function clearCategoryEmbeddingCache() {
  _categoryEmbeddingCache = null;
}

/**
 * Cluster a single FAQ into the best matching category using vector similarity.
 * Updates the FAQ's category_path in the database.
 *
 * @param {string} faqId - The FAQ document _id
 * @param {boolean} dryRun - If true, don't save to DB
 * @returns {{ faqId, question, oldPath, newPath, newLabel, similarity, changed: boolean }}
 */
export async function clusterSingleFAQ(faqId, dryRun = false) {
  const faq = await FAQ.findById(faqId).lean();
  if (!faq) throw new Error(`FAQ ${faqId} not found`);

  const categoryEmbeddings = await getCategoryEmbeddings();
  const fullText = `${faq.question} ${faq.answer}`;
  const textEmbedding = await getEmbedding(fullText);

  let bestCatId = 'timeline';
  let bestSim = -1;

  for (const [catId, embedding] of categoryEmbeddings) {
    const sim = cosineSimilarity(textEmbedding, embedding);
    if (sim > bestSim) {
      bestSim = sim;
      bestCatId = catId;
    }
  }

  const cat = CANONICAL_CATEGORIES.find(c => c.id === bestCatId);
  const newPath = cat.path;
  const newLabel = cat.label;
  const oldPath = faq.category_path;
  const changed = oldPath !== newPath;

  if (!dryRun && changed) {
    await FAQ.findByIdAndUpdate(faqId, { category_path: newPath });
  }

  return {
    faqId,
    question: faq.question.substring(0, 80),
    oldPath,
    newPath,
    newLabel,
    similarity: Math.round(bestSim * 1000) / 1000,
    changed,
  };
}

/**
 * Cluster all unclustered or all FAQs in the database.
 * Returns a summary of what changed.
 *
 * @param {Object} options
 * @param {boolean} options.dryRun - Don't persist changes
 * @param {string} [options.scope] - 'all' | 'uncategorized' | 'root' (category_path = 'root' or starts with 'root.general')
 * @param {Function} [options.onProgress] - Called with ({ current, total, result }) for progress tracking
 */
export async function clusterAllFAQs({ dryRun = false, scope = 'all', onProgress } = {}) {
  const filter = {};

  if (scope === 'uncategorized') {
    filter.$or = [
      { category_path: 'root' },
      { category_path: 'root.general' },
      { category_path: null },
    ];
  } else if (scope === 'root') {
    filter.category_path = { $regex: '^root$' };
  }

  const total = await FAQ.countDocuments(filter);
  logger.info('Clustering', `Starting clustering job — ${total} FAQs (scope: ${scope}, dryRun: ${dryRun})`);

  const categoryEmbeddings = await getCategoryEmbeddings();
  const cursor = FAQ.find(filter).lean().cursor();
  const results = [];
  let current = 0;

  for await (const faq of cursor) {
    current++;
    const fullText = `${faq.question} ${faq.answer}`;
    const textEmbedding = await getEmbedding(fullText);

    let bestCatId = 'timeline';
    let bestSim = -1;

    for (const [catId, embedding] of categoryEmbeddings) {
      const sim = cosineSimilarity(textEmbedding, embedding);
      if (sim > bestSim) {
        bestSim = sim;
        bestCatId = catId;
      }
    }

    const cat = CANONICAL_CATEGORIES.find(c => c.id === bestCatId);
    const newPath = cat.path;
    const oldPath = faq.category_path;
    const changed = oldPath !== newPath;

    if (!dryRun && changed) {
      await FAQ.findByIdAndUpdate(faq._id, { category_path: newPath });
    }

    const result = {
      faqId: faq._id.toString(),
      question: faq.question.substring(0, 80),
      oldPath,
      newPath,
      newLabel: cat.label,
      similarity: Math.round(bestSim * 1000) / 1000,
      changed,
    };

    results.push(result);
    if (onProgress) onProgress({ current, total, result });
  }

  const changedCount = results.filter(r => r.changed).length;
  const summary = {
    total,
    changed: changedCount,
    unchanged: total - changedCount,
    dryRun,
    results,
  };

  logger.success('Clustering', `Job complete — ${changedCount}/${total} FAQs re-categorized.`);
  return summary;
}

/**
 * Auto-create or update FAQCategory documents for all 14 canonical categories.
 * Also updates the MongoDB vector index to include these categories.
 */
export async function syncCanonicalCategories() {
  const categoryEmbeddings = await getCategoryEmbeddings();
  const results = [];

  for (const cat of CANONICAL_CATEGORIES) {
    const embedding = categoryEmbeddings.get(cat.id) || new Array(384).fill(0);

    const existing = await FAQCategory.findOne({ path: cat.path });
    if (existing) {
      existing.label = cat.label;
      existing.description = cat.description;
      existing.embedding = embedding;
      await existing.save();
      results.push({ action: 'updated', path: cat.path, label: cat.label });
    } else {
      await FAQCategory.create({
        path: cat.path,
        label: cat.label,
        description: cat.description,
        embedding,
        parent: null,
      });
      results.push({ action: 'created', path: cat.path, label: cat.label });
    }
  }

  logger.success('Clustering', `Canonical category sync complete — ${results.length} categories processed.`);
  return results;
}

/**
 * Get clustering statistics — how many FAQs per category currently.
 */
export async function getClusterStats() {
  const stats = await FAQ.aggregate([
    { $group: { _id: '$category_path', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return stats;
}