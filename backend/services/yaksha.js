/**
 * Yaksha AI Pipeline — Full Phase 2 orchestrator (MongoDB Version)
 *
 * Flow: Embed query → Check cache → Tree route → Hybrid search → Groq synthesis → Cache result
 */

import FAQ from '../models/FAQ.js';
import FAQCategory from '../models/FAQCategory.js';
import SemanticCache from '../models/SemanticCache.js';
import { synthesizeAnswer, condenseQuery } from './groq.js';
import { getEmbedding } from './embeddingService.js';

/**
 * Run the full Yaksha pipeline for a validated query.
 *
 * @param {string} cleanedQuery - The validated, cleaned query text
 * @param {Array} history - Array of previous chat messages
 * @returns {Promise<{answer: string, sentiment: string, source: string, escalate: boolean}>}
 */
export async function runYakshaPipeline(cleanedQuery, history = []) {
  const hasHistory = history && history.length > 0;
  
  // Step 1: Condense/rephrase latest query based on conversation context if history exists
  const searchQuery = hasHistory 
    ? await condenseQuery(cleanedQuery, history) 
    : cleanedQuery;

  // Step 2: Generate query embedding for search & routing
  const queryEmbedding = await getEmbedding(searchQuery);

  // Step 3: Check semantic cache (ONLY if this is the first turn / no history)
  if (!hasHistory) {
    const cacheResult = await checkSemanticCache(queryEmbedding);
    if (cacheResult) {
      return {
        answer: cacheResult.groq_response,
        sentiment: cacheResult.sentiment || 'neutral',
        source: 'cache',
        escalate: false,
      };
    }
  }

  // Step 4: Tree routing — find best category
  const categoryPath = await findBestCategory(queryEmbedding);

  // Step 5: Hybrid search — semantic + keyword
  const faqs = await hybridSearch(queryEmbedding, searchQuery, categoryPath);

  // Step 6: Check if we have good matches
  if (faqs.length === 0 || faqs[0].score < 0.40) {
    return {
      answer: 'I couldn\'t find a confident answer to your question in our FAQ database. Let\'s get help from the community!',
      sentiment: 'neutral',
      source: 'yaksha',
      escalate: true,
    };
  }

  // Step 7: Groq synthesis from top FAQs + multi-turn history
  const { answer, sentiment } = await synthesizeAnswer(cleanedQuery, history, faqs);

  // Step 8: Cache the result (ONLY if this is the first turn / no history)
  let cacheId = null;
  if (!hasHistory) {
    try {
      const cacheEntry = await SemanticCache.create({
        original_query: cleanedQuery,
        query_embedding: queryEmbedding,
        groq_response: answer,
        sentiment,
      });
      cacheId = cacheEntry._id;
    } catch (err) {
      console.error('⚠️ Cache write failed:', err.message);
    }
  }

  return {
    answer,
    sentiment,
    source: 'yaksha',
    escalate: false,
    cacheId,
  };
}

/**
 * Check semantic cache for near-identical queries.
 * Returns cached response if similarity ≥ 0.95 and entry is < 30 days old.
 * (Note: The TTL index handles deleting old entries, so we just search what is live)
 */
async function checkSemanticCache(queryEmbedding) {
  try {
    const results = await SemanticCache.aggregate([
      {
        $vectorSearch: {
          index: 'cache_vector_index',
          path: 'query_embedding',
          queryVector: queryEmbedding,
          numCandidates: 10,
          limit: 1
        }
      },
      {
        $project: {
          groq_response: 1,
          sentiment: 1,
          similarity: { $meta: 'searchScore' }
        }
      }
    ]);

    if (results.length > 0 && results[0].similarity >= 0.95) {
      console.log(`  📦 Cache hit! Similarity: ${results[0].similarity.toFixed(4)}`);
      return results[0];
    }

    return null;
  } catch (error) {
    console.error('⚠️ Cache lookup failed:', error.message);
    return null;
  }
}

/**
 * Find best matching category via embedding similarity.
 */
async function findBestCategory(queryEmbedding) {
  try {
    const results = await FAQCategory.aggregate([
      {
        $vectorSearch: {
          index: 'category_vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: 10,
          limit: 1
        }
      }
    ]);

    if (results.length > 0) {
      return results[0].path;
    }

    return 'root'; // Fallback: search all
  } catch (error) {
    console.error('⚠️ Category routing failed:', error.message);
    return 'root';
  }
}

/**
 * Computes a keyword overlap score in memory to boost exact word match relevance.
 */
function computeKeywordRank(text, query) {
  const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (queryTokens.length === 0) return 0;
  
  const cleanText = text.toLowerCase();
  let matches = 0;
  for (const token of queryTokens) {
    if (cleanText.includes(token)) {
      matches++;
    }
  }
  return matches / queryTokens.length; // value between 0 and 1
}

/**
 * Hybrid search combining semantic similarity + keyword matching.
 * Score = (Atlas Search Vector Similarity) * 0.7 + (JS Keyword Match) * 0.3
 */
async function hybridSearch(queryEmbedding, queryText, categoryPath) {
  try {
    const searchStage = {
      index: 'faq_vector_index',
      path: 'embedding',
      queryVector: queryEmbedding,
      numCandidates: 30,
      limit: 10
    };

    if (categoryPath && categoryPath !== 'root') {
      // Fetch the subtree paths for the matched category to bypass Atlas Vector Search regex limitation
      const subtreeCategories = await FAQCategory.find({ path: { $regex: `^${categoryPath}(\\.|$)` } }).select('path').lean();
      const paths = subtreeCategories.map(c => c.path);
      
      if (paths.length > 0) {
        searchStage.filter = {
          category_path: { $in: paths }
        };
      } else {
        searchStage.filter = {
          category_path: categoryPath
        };
      }
    }

    const vectorResults = await FAQ.aggregate([
      {
        $vectorSearch: searchStage
      },
      {
        $project: {
          question: 1,
          answer: 1,
          category_path: 1,
          vectorScore: { $meta: 'searchScore' }
        }
      }
    ]);

    // If no results matched the category, fall back to searching all categories
    if (vectorResults.length === 0 && categoryPath !== 'root') {
      return await hybridSearch(queryEmbedding, queryText, 'root');
    }

    const scoredFaqs = vectorResults.map(faq => {
      const textRank = computeKeywordRank(faq.question, queryText) * 0.7 + computeKeywordRank(faq.answer, queryText) * 0.3;
      const score = faq.vectorScore * 0.7 + textRank * 0.3;
      return {
        question: faq.question,
        answer: faq.answer,
        score
      };
    });

    // Sort by final combined score descending
    scoredFaqs.sort((a, b) => b.score - a.score);

    return scoredFaqs.slice(0, 3);
  } catch (error) {
    console.error('⚠️ Hybrid search failed:', error.message);

    // Fallback: try without category filter on database failure
    if (categoryPath !== 'root') {
      try {
        return await hybridSearch(queryEmbedding, queryText, 'root');
      } catch (fallbackError) {
        console.error('⚠️ Fallback search also failed:', fallbackError.message);
        return [];
      }
    }
    return [];
  }
}

/**
 * Cache a Groq response with its query embedding for future lookups.
 */
async function cacheResponse(queryEmbedding, originalQuery, response, sentiment) {
  try {
    await SemanticCache.create({
      original_query: originalQuery,
      query_embedding: queryEmbedding,
      groq_response: response,
      sentiment,
    });
  } catch (error) {
    console.error('⚠️ Cache insertion failed:', error.message);
  }
}
