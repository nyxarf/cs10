/**
 * US-016: Corpus Feedback Loop (MongoDB Version)
 * Promotes high-quality community answers into the MongoDB FAQ corpus.
 * Triggered when an answer reaches net_score ≥ 5 AND ai_check_passed is true.
 */

import FAQ from '../models/FAQ.js';
import { getEmbedding } from './embeddingService.js';
import Question from '../models/Question.js';
import Answer from '../models/Answer.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

/**
 * Promote a community answer to the FAQ corpus.
 * This function is idempotent — calling it multiple times for the same answer is safe.
 *
 * @param {Object} answer - The MongoDB Answer document
 */
export async function promoteToCorpus(answer) {
  // Idempotent guard
  if (answer.promoted_to_corpus) return;

  try {
    // Fetch the associated question
    const question = await Question.findById(answer.question_id);
    if (!question) {
      logger.warn('Corpus', `Promotion skipped — question not found for answer ${answer._id}`);
      return;
    }

    // Generate embedding for the combined Q+A text
    const fullText = `${question.rephrased_query} ${answer.content}`;
    const embedding = await getEmbedding(fullText);

    // Insert into MongoDB FAQ corpus using findOneAndUpdate for idempotence
    await FAQ.findOneAndUpdate(
      { question: question.rephrased_query },
      {
        category_path: `root.${question.category}`,
        question: question.rephrased_query,
        answer: answer.content,
        embedding: embedding,
        source: 'community',
      },
      { upsert: true, new: true }
    );

    // Update MongoDB documents
    await Answer.findByIdAndUpdate(answer._id, { promoted_to_corpus: true });
    await Question.findByIdAndUpdate(answer.question_id, { status: 'answered' });

    // Award bonus XP to the answerer
    await User.findByIdAndUpdate(answer.answered_by, { $inc: { xp: 25 } });

    logger.success('Corpus', `Answer ${answer._id} promoted to FAQ corpus. Answerer awarded 25 XP.`);
  } catch (error) {
    logger.error('Corpus', `Promotion failed: ${error.message}`);
    // Don't throw — promotion failure should not crash the vote endpoint
  }
}
