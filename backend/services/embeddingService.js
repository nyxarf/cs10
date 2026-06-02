/**
 * Pluggable, modular, and lazy-loaded Embedding Service.
 * Acts as a wrapper for generating text embeddings.
 *
 * For horizontal scalability:
 * - If `EMBEDDING_API_URL` is set in the environment, it delegates vector generation
 *   to an external embedding API (which keeps the event loop of this instance unblocked).
 * - Otherwise, it falls back to loading and running the model 100% locally using
 *   `@xenova/transformers` (~23MB MiniLM model), enabling robust offline support.
 */

import { pipeline } from '@xenova/transformers';
import logger from '../utils/logger.js';

let extractor = null;

/**
 * Lazy-loads the local pipeline for feature extraction.
 */
async function getLocalExtractor() {
  if (!extractor) {
    logger.info('Embeddings', 'Loading local model (Xenova/all-MiniLM-L6-v2)...');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    logger.success('Embeddings', 'Local embedding model loaded.');
  }
  return extractor;
}

/**
 * Generates local embedding vector.
 *
 * @param {string} text - Cleaned text to embed
 * @returns {Promise<number[]>} 384-dimensional float array
 */
async function generateLocalEmbedding(text) {
  const extract = await getLocalExtractor();
  const output = await extract(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Generates external embedding vector via HTTP API.
 *
 * @param {string} text - Cleaned text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateRemoteEmbedding(text) {
  const apiUrl = process.env.EMBEDDING_API_URL;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const headers = {
      'Content-Type': 'application/json',
    };
    if (process.env.EMBEDDING_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.EMBEDDING_API_KEY}`;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Embedding API response error: ${response.status}`);
    }

    const data = await response.json();
    if (data && Array.isArray(data.embedding)) {
      return data.embedding;
    }
    throw new Error('Invalid response structure from external embedding service');
  } catch (error) {
    logger.warn('Embeddings', `Remote embedding failed, falling back to local model: ${error.message}`);
    return generateLocalEmbedding(text);
  }
}

/**
 * Generate a 384-dimensional embedding for the given text.
 *
 * @param {string} text - The text to embed
 * @returns {Promise<number[]>} 384-dimensional float array
 */
export async function getEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a valid, non-empty string for embedding');
  }

  if (process.env.EMBEDDING_API_URL) {
    return generateRemoteEmbedding(text);
  }

  return generateLocalEmbedding(text);
}

/**
 * Generate embeddings for multiple texts in batch.
 *
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<number[][]>} Array of embeddings
 */
export async function getBatchEmbeddings(texts) {
  if (!Array.isArray(texts)) {
    throw new Error('Batch embeddings input must be an array of strings');
  }

  const embeddings = [];
  for (const text of texts) {
    const embedding = await getEmbedding(text);
    embeddings.push(embedding);
  }
  return embeddings;
}
