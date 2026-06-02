import FAQ from '../models/FAQ.js';
import FAQCategory from '../models/FAQCategory.js';

// Canonical category definitions — used for consistent section IDs and labels.
// Maps category path prefix (e.g. 'root.about_the_internship') to stable section ID.
export const CATEGORY_SECTION_MAP = {
  'root.about_the_internship': { id: 'about',          label: 'About the Internship'  },
  'root.noc':                  { id: 'noc',            label: 'NOC'                   },
  'root.certificate':          { id: 'certificate',    label: 'Certificate'           },
  'root.rosetta':              { id: 'rosetta',        label: 'Rosetta'               },
  'root.teams':                { id: 'teams',          label: 'Teams'                 },
  'root.projects':             { id: 'projects',       label: 'Projects'              },
  'root.vibe':                 { id: 'vibe',           label: 'ViBe platform'         },
  'root.offer_letter':         { id: 'offer',          label: 'Offer letter'          },
  'root.yaksha':               { id: 'yaksha',         label: 'Yaksha'                },
  'root.support_channels':     { id: 'support',        label: 'Support channels'      },
  'root.completion':           { id: 'completion',     label: 'Completion'            },
  'root.policies':             { id: 'policies',       label: 'Policies'              },
  'root.mentor':               { id: 'mentor',         label: 'Mentor'                },
  'root.timeline':             { id: 'timeline',       label: 'Timeline'              },
  'root.general':              { id: 'general',        label: 'General'               },
};

// Short aliases for legacy/partial path matching (e.g. 'root.noc' → 'noc')
const PATH_PREFIX_TO_ID = {};
for (const [path, info] of Object.entries(CATEGORY_SECTION_MAP)) {
  PATH_PREFIX_TO_ID[path.replace('root.', '')] = info.id;
}

/**
 * Derive a stable section ID from a category path string.
 * Falls back to a best-effort match on path prefix.
 */
function deriveSectionId(categoryPath) {
  if (!categoryPath) return 'general';

  // Direct match
  const direct = CATEGORY_SECTION_MAP[categoryPath];
  if (direct) return direct.id;

  // Strip 'root.' prefix and try exact match on remainder
  const remainder = categoryPath.replace(/^root\./, '');
  const byPrefix = PATH_PREFIX_TO_ID[remainder];
  if (byPrefix) return byPrefix;

  // Partial prefix match (e.g. 'root.noc.something' → 'noc')
  const topLevel = remainder.split('.')[0];
  return PATH_PREFIX_TO_ID[topLevel] || topLevel || 'general';
}

/**
 * Get the canonical label for a category path.
 */
function deriveSectionLabel(categoryPath) {
  const direct = CATEGORY_SECTION_MAP[categoryPath];
  if (direct) return direct.label;

  const remainder = categoryPath?.replace(/^root\./, '') || '';
  const topLevel = remainder.split('.')[0];
  const mapped = PATH_PREFIX_TO_ID[topLevel];

  if (mapped) {
    const info = Object.values(CATEGORY_SECTION_MAP).find(c => c.id === mapped);
    return info?.label || mapped;
  }

  // Fallback: prettify the raw path segment
  return topLevel
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Service handling standard FAQs browsing, searching, and section indexing.
 */
class FAQService {
  /**
   * Fetch FAQs grouped by sections (with optional search/section filters).
   *
   * @param {Object} query - Filtering queries
   * @param {string} [query.section] - Optional category path filter
   * @param {string} [query.search] - Optional text search keyword
   * @returns {Promise<{sections: Object, total: number}>} Grouped sections and count
   */
  async listFaqs({ section, search } = {}) {
    const filter = {};
    if (section) {
      filter.category_path = new RegExp(`^root\\.${section}(\\.|$)`);
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const [faqs, categories] = await Promise.all([
      FAQ.find(filter)
        .select('category_path question answer source is_pinned')
        .sort({ is_pinned: -1, category_path: 1, question: 1 })
        .lean(),
      FAQCategory.find().select('path label').lean(),
    ]);

    const labelMap = {};
    for (const cat of categories) {
      labelMap[cat.path] = cat.label;
    }

    const sections = {};
    for (const faq of faqs) {
      const categoryPath = faq.category_path || 'root.general';
      const sectionId = deriveSectionId(categoryPath);

      if (!sections[sectionId]) {
        sections[sectionId] = {
          id: sectionId,
          label: deriveSectionLabel(categoryPath),
          faqs: [],
        };
      }
      sections[sectionId].faqs.push(faq);
    }

    return { sections, total: faqs.length };
  }

  /**
   * Fetch a list of active sections containing count stats.
   *
   * @returns {Promise<{sections: Array}>} Sections with path, label and count
   */
  async listSections() {
    const [aggregation, categories] = await Promise.all([
      FAQ.aggregate([
        {
          $group: {
            _id: '$category_path',
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      FAQCategory.find().select('path label').lean(),
    ]);

    const labelMap = {};
    for (const cat of categories) {
      labelMap[cat.path] = cat.label;
    }

    // Build a lookup keyed by canonical ID for fast dedup
    const sectionMap = {};
    for (const entry of aggregation) {
      const categoryPath = entry._id || 'root.general';
      const sectionId = deriveSectionId(categoryPath);

      if (!sectionMap[sectionId]) {
        sectionMap[sectionId] = {
          id: sectionId,
          path: categoryPath,
          label: deriveSectionLabel(categoryPath),
          count: 0,
        };
      }
      sectionMap[sectionId].count += entry.count;
    }

    // Sort sections by canonical category order
    const CANONICAL_ORDER = [
      'about', 'noc', 'certificate', 'rosetta', 'teams',
      'projects', 'vibe', 'offer', 'yaksha', 'support',
      'completion', 'policies', 'mentor', 'timeline',
    ];

    const sections = Object.values(sectionMap).sort((a, b) => {
      const ai = CANONICAL_ORDER.indexOf(a.id);
      const bi = CANONICAL_ORDER.indexOf(b.id);
      if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    return { sections };
  }
}

export default new FAQService();
