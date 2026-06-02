/**
 * groq.js
 * Groq LLM service wrapper for the Samagama platform.
 *
 * Model   : llama-3.1-8b-instant
 * Policy  : temperature=0 for deterministic, reproducible output.
 * Logging : All calls are persisted to the GroqLog collection.
 */

import Groq from 'groq-sdk';
import logger from '../utils/logger.js';
import GroqLog from '../models/GroqLog.js';

const MODEL = 'llama-3.1-8b-instant';

/**
 * Lazy Groq client — instantiated on first use so that dotenv
 * has already loaded GROQ_API_KEY from .env before construction.
 */
let _groq = null;
function getGroqClient() {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) {
      logger.warn('Groq', 'GROQ_API_KEY is not configured. LLM features will be unavailable.');
    }
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}


async function executeGroqCall(actionName, options, customClient = null) {
  const client = customClient || getGroqClient();
  try {
    const completion = await client.chat.completions.create(options);

    
    GroqLog.create({
      action: actionName,
      model: options.model,
      prompt_summary: typeof options.messages.slice(-1)[0]?.content === 'string' 
        ? options.messages.slice(-1)[0].content.substring(0, 200) 
        : 'Complex prompt',
      response_summary: (completion.choices[0]?.message?.content || '').substring(0, 200),
      tokens_prompt: completion.usage?.prompt_tokens || 0,
      tokens_completion: completion.usage?.completion_tokens || 0,
      tokens_total: completion.usage?.total_tokens || 0,
    }).catch(err => logger.warn('Groq', `Audit log write failed: ${err.message}`));

    return completion;
  } catch (error) {
    GroqLog.create({
      action: actionName,
      model: options.model,
      prompt_summary: 'ERROR',
      response_summary: error.message,
    }).catch(() => {});
    throw error;
  }
}

/**
 * Safe JSON parse with fallback
 */
function safeParseJSON(text, fallback) {
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Robustly parses the Yaksha response from Groq.
 * Handles standard JSON, markdown code blocks, JSON with unescaped newlines inside quotes, and clean plain text fallback.
 * Guarantees a raw JSON string is NEVER returned to the user.
 */
export function parseYakshaResponse(text) {
  const cleanInput = (text || '').trim();
  if (!cleanInput) {
    return { answer: 'I could not generate an answer. Please try rephrasing your question.', sentiment: 'neutral' };
  }

  // 1. Try standard parsing of the entire text
  try {
    const parsed = JSON.parse(cleanInput);
    if (parsed && typeof parsed.answer === 'string') {
      return {
        answer: parsed.answer,
        sentiment: parsed.sentiment || 'neutral'
      };
    }
  } catch (e) {
    // Standard parsing failed
  }

  // 2. Try to find a JSON block { ... } and parse it
  const jsonMatch = cleanInput.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const jsonCandidate = jsonMatch[0];
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (parsed && typeof parsed.answer === 'string') {
        return {
          answer: parsed.answer,
          sentiment: parsed.sentiment || 'neutral'
        };
      }
    } catch (e) {
      // JSON block has syntax errors (commonly unescaped control chars/newlines inside the answer string)
      // Let's attempt regex key extraction for "answer" and "sentiment"
      try {
        const answerMatch = jsonCandidate.match(/"answer"\s*:\s*"([\s\S]*?)"\s*,\s*"sentiment"/i) 
                            || jsonCandidate.match(/"answer"\s*:\s*"([\s\S]*?)"\s*\}/i);
        const sentimentMatch = jsonCandidate.match(/"sentiment"\s*:\s*"([^"]*?)"/i);

        if (answerMatch && answerMatch[1]) {
          let extractedAnswer = answerMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\t/g, '\t')
            .trim();

          return {
            answer: extractedAnswer,
            sentiment: sentimentMatch ? sentimentMatch[1].trim() : 'neutral'
          };
        }
      } catch (regexError) {
        logger.warn('Groq', `JSON regex recovery failed: ${regexError.message}`);
      }
    }
  }

  // 3. Fallback: If it starts like a JSON structure but is completely corrupted, strip the JSON keys/braces
  let fallbackAnswer = cleanInput;
  if (fallbackAnswer.startsWith('{')) {
    fallbackAnswer = fallbackAnswer
      .replace(/^\{\s*"answer"\s*:\s*"/i, '')
      .replace(/"\s*,\s*"sentiment"\s*:\s*"[^"]*"\s*\}$/i, '')
      .replace(/"\s*\}$/, '')
      .trim();
  }

  // Double check: if it still looks like a JSON block, parse whatever we can
  if (fallbackAnswer.includes('"answer":') || fallbackAnswer.startsWith('{')) {
    fallbackAnswer = fallbackAnswer.replace(/["{}]/g, '').replace(/answer\s*:\s*/i, '').trim();
  }

  return {
    answer: fallbackAnswer || 'I could not generate an answer. Please try rephrasing your question.',
    sentiment: 'neutral'
  };
}


/**
 * US-002: Classify a query as VALID, ABUSIVE, GIBBERISH, or OFF_TOPIC.
 * Also returns a cleaned version with typos fixed.
 */
export async function classifyQuery(query) {
  try {
    const completion = await executeGroqCall('classifyQuery', {
      model: MODEL,
      temperature: 0,
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content: `You are a query validator for a college/internship FAQ system called Samagama.
Classify the user query into one of: VALID, ABUSIVE, GIBBERISH, OFF_TOPIC.
- VALID: genuine question about the program (registration, schedule, accommodation, payments, teams, internship, NOC, selection, certificate, general)
- ABUSIVE: contains profanity, hate speech, or harassment
- GIBBERISH: random characters, keyboard mashing, incomprehensible text
- OFF_TOPIC: clearly unrelated to a college event or program (e.g. "what is 2+2", "write me a poem")

Also return a cleaned version of the query (fix spelling, expand abbreviations like "reg" → "registration").

Respond ONLY as valid JSON with no extra text:
{"classification":"VALID","reason":"","cleaned_query":"..."}`
        },
        {
          role: 'user',
          content: query,
        },
      ],
    });

    const result = safeParseJSON(
      completion.choices[0]?.message?.content || '',
      { classification: 'VALID', reason: '', cleaned_query: query }
    );

    return {
      classification: result.classification || 'VALID',
      reason: result.reason || '',
      cleaned_query: result.cleaned_query || query,
    };
  } catch (error) {
    logger.error('Groq.classifyQuery', error.message);
    // Default to VALID on failure to avoid false rejections
    return { classification: 'VALID', reason: '', cleaned_query: query };
  }
}

/**
 * 2-Step Community Posting Filter:
 * Routes a new community question into one of three buckets based on relevance/quality:
 * - publish: clear, on-topic, useful
 * - review: unclear or borderline
 * - hide: low-value, repeated, off-topic, spammy
 */
export async function classifyForPosting(query) {
  try {
    const completion = await executeGroqCall('classifyForPosting', {
      model: MODEL,
      temperature: 0,
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content: `You are a moderation AI for a college/internship FAQ community board (Samagama).
Given a user's question, route it into one of three buckets:
1. "publish" : For clear, on-topic, and useful questions.
2. "review" : For unclear, borderline, or poorly phrased questions.
3. "hide" : For low-value, gibberish, abusive, spammy, or completely off-topic posts.

Respond ONLY as valid JSON:
{"action":"publish", "reason":""}`
        },
        {
          role: 'user',
          content: query,
        },
      ],
    });

    const result = safeParseJSON(
      completion.choices[0]?.message?.content || '',
      { action: 'review', reason: 'Failed to parse classification' }
    );

    const validActions = ['publish', 'review', 'hide'];
    const action = validActions.includes(result.action) ? result.action : 'review';

    return { action, reason: result.reason || '' };
  } catch (error) {
    logger.error('Groq.classifyForPosting', error.message);
    // Default to review on failure
    return { action: 'review', reason: 'API error' };
  }
}

/**
 * US-006: Synthesize a natural language answer from FAQ snippets.
 * Returns answer + sentiment classification.
 */
/**
 * Condenses a conversational follow-up query into a standalone question based on history.
 */
export async function condenseQuery(query, history = []) {
  if (!history || history.length === 0) {
    return query;
  }

  try {
    const formattedHistory = history
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    const completion = await executeGroqCall('condenseQuery', {
      model: MODEL,
      temperature: 0,
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant for the Samagama FAQ platform.
Given a Conversation History and a Follow-up Question, rephrase the Follow-up Question into a standalone question that can be searched in an FAQ database.
The standalone question must:
- Be grammatically correct.
- Be self-contained and clear, referring explicitly to the context discussed in history (e.g., expand pronouns like "it", "they", "that").
- Do NOT answer the question. Just rephrase it.
- Keep it concise.

Respond ONLY with the standalone rephrased question string with no extra text or markdown formatting.`
        },
        {
          role: 'user',
          content: `Conversation History:\n${formattedHistory}\n\nFollow-up Question: ${query}\n\nStandalone Question:`
        }
      ]
    });

    const result = completion.choices[0]?.message?.content?.trim();
    logger.debug('Groq.condenseQuery', `Query condensed successfully.`);
    return result || query;
  } catch (error) {
    logger.error('Groq.condenseQuery', error.message);
    return query; // fallback to original query
  }
}

/**
 * US-006: Synthesize a natural language answer from FAQ snippets.
 * Support continuous multi-turn chat history.
 */
export async function synthesizeAnswer(query, history = [], faqContext = []) {
  try {
    const contextBlock = faqContext
      .map((faq, i) => `${i + 1}. Q: ${faq.question}\n   A: ${faq.answer}`)
      .join('\n\n');

    const messages = [
      {
        role: 'system',
        content: `You are Yaksha, the helpful FAQ assistant for Samagama (an internship platform by Vicharanashala, IIT Ropar).
Answer the user's question using ONLY the provided FAQ context below.
Do not invent information. If the context does not fully answer the question, say so clearly.

Guidelines for your answer:
- Provide an EXTREMELY thorough, detailed, and comprehensive answer that fully addresses the question.
- Do not summarize or omit important details, schedules, requirements, rules, or contact information. If multiple details are in the context, list ALL of them.
- Use multiple paragraphs to separate different concepts or topics.
- Organize your answer using clear subheadings starting with "### " (e.g., "### Requirements", "### Contact Info", "### Important Dates") to structure the information beautifully.
- Bold important key terms, deadlines, percentages, emails, and criteria using standard Markdown "**key term**".
- Format lists clearly using bullet points (- ) or numbers (1. ) to explain steps or multiple items, keeping double newlines between list items or sections.
- Write in a warm, helpful, and highly professional tone.

FAQ Context:
${contextBlock}

Also classify the user's emotional tone based on their latest query as one of: positive, neutral, frustrated, confused.

Respond ONLY as valid JSON. Ensure double quotes inside the answer text are escaped as \\" and all newlines inside the JSON string are properly escaped as \\n:
{"answer": "...", "sentiment": "..."}`
      }
    ];

    // Append history (previous user/assistant messages)
    if (history && history.length > 0) {
      history.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    // Append latest question
    messages.push({
      role: 'user',
      content: query
    });

    const completion = await executeGroqCall('synthesizeAnswer', {
      model: MODEL,
      temperature: 0,
      max_tokens: 800,
      messages,
    });

    const result = parseYakshaResponse(completion.choices[0]?.message?.content || '');
    return result;

  } catch (error) {
    logger.error('Groq.synthesizeAnswer', error.message);
    return {
      answer: 'I\'m having trouble processing your question right now. Please try again in a moment.',
      sentiment: 'neutral',
    };
  }
}

/**
 * US-013: AI-check a community answer for relevance and ethics.
 */
export async function checkAnswer(question, answer) {
  try {
    const completion = await executeGroqCall('checkAnswer', {
      model: MODEL,
      temperature: 0,
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content: `You check community answers for a college/internship FAQ system called Samagama.
Given a question and a proposed answer, determine:
1. Is the answer relevant to the question? (Does it actually address what was asked?)
2. Is it ethical? (No profanity, no harassment, no misinformation about the event.)

An answer can be short or informal — that is fine. It just needs to actually address the question.

Respond ONLY as valid JSON:
{"passes": true, "flag_reason": null}
or
{"passes": false, "flag_reason": "Brief reason here"}`
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nProposed Answer: ${answer}`,
        },
      ],
    });

    const result = safeParseJSON(
      completion.choices[0]?.message?.content || '',
      { passes: true, flag_reason: null }
    );

    return {
      passes: result.passes !== false,
      flag_reason: result.flag_reason || null,
    };
  } catch (error) {
    logger.error('Groq.checkAnswer', error.message);
    // Default to passes: true on failure to avoid blocking valid answers
    return { passes: true, flag_reason: null };
  }
}

/**
 * Fetch categories from DB once per process (cached for 5 min).
 * Returns array of { path, label, description } sorted by label.
 */
let _categoryCache = null;
let _categoryCacheAt = 0;
const CATEGORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCategories() {
  if (_categoryCache && Date.now() - _categoryCacheAt < CATEGORY_CACHE_TTL) {
    return _categoryCache;
  }
  try {
    const FAQCategory = (await import('../models/FAQCategory.js')).default;
    const cats = await FAQCategory.find({}, 'path label description').sort({ label: 1 }).lean();
    _categoryCache = cats.filter(c => c.path && c.label);
    _categoryCacheAt = Date.now();
    logger.debug('Groq.getCategories', `Loaded ${_categoryCache.length} categories from DB`);
    return _categoryCache;
  } catch (err) {
    logger.warn('Groq.getCategories', `DB fetch failed, using fallback: ${err.message}`);
    // Fallback to known paths if DB is unavailable
    return [
      { path: 'root.about_the_internship', label: 'About the Internship', description: 'General questions about the program' },
      { path: 'root.noc',                  label: 'NOC',                  description: 'No Objection Certificate questions' },
      { path: 'root.certificate',           label: 'Certificate',          description: 'Certificate and credential questions' },
      { path: 'root.rosetta',               label: 'Rosetta',              description: 'Rosetta journal questions' },
      { path: 'root.teams',                 label: 'Teams',                description: 'Team formation questions' },
      { path: 'root.projects',              label: 'Projects',             description: 'Project and phase questions' },
      { path: 'root.vibe',                  label: 'ViBe platform',        description: 'ViBe learning platform' },
      { path: 'root.offer_letter',          label: 'Offer letter',         description: 'Offer letter questions' },
      { path: 'root.yaksha',                label: 'Yaksha',               description: 'Yaksha AI chatbot questions' },
      { path: 'root.support_channels',      label: 'Support channels',     description: 'Support and contact questions' },
      { path: 'root.completion',            label: 'Completion',           description: 'Internship completion questions' },
      { path: 'root.policies',              label: 'Policies',             description: 'Attendance, leave, conduct policies' },
      { path: 'root.mentor',                label: 'Mentor',               description: 'Mentor-related questions' },
      { path: 'root.timeline',              label: 'Timeline',             description: 'Timeline and dates questions' },
    ];
  }
}

/**
 * Categorize a question text against the live DB category list.
 * Returns the best matching `path` (e.g. "root.noc") and `label`.
 * Fail-open: returns "root.about_the_internship" on any error.
 *
 * @param {string} question - The question text to categorize
 * @returns {Promise<{ path: string, label: string }>}
 */
export async function categorizeQuestion(question) {
  const categories = await getCategories();
  const categoryList = categories
    .map(c => `- path: "${c.path}" | label: "${c.label}" | about: ${c.description || c.label}`)
    .join('\n');

  try {
    const completion = await executeGroqCall('categorizeQuestion', {
      model: MODEL,
      temperature: 0,
      max_tokens: 80,
      messages: [
        {
          role: 'system',
          content: `You are a category classifier for the Samagama internship FAQ system.

Available categories:
${categoryList}

Given a question, pick the SINGLE most appropriate category path.
Respond ONLY with valid JSON, no markdown:
{ "path": "root.xxx", "label": "Category Label" }`,
        },
        { role: 'user', content: `Question: "${question}"` },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    const result = safeParseJSON(raw, {});

    const matched = categories.find(c => c.path === result.path);
    if (matched) {
      return { path: matched.path, label: matched.label };
    }
    // Fallback: partial label match
    const lower = (result.label || '').toLowerCase();
    const byLabel = categories.find(c => c.label.toLowerCase() === lower);
    if (byLabel) return { path: byLabel.path, label: byLabel.label };

    logger.warn('Groq.categorizeQuestion', `No match for path="${result.path}", falling back`);
    return { path: 'root.about_the_internship', label: 'About the Internship' };
  } catch (error) {
    logger.error('Groq.categorizeQuestion', error.message);
    return { path: 'root.about_the_internship', label: 'About the Internship' };
  }
}

/**
 * US-008: Rephrase a raw query into a clear, categorized question.
 * Category is now fetched from DB (via getCategories) instead of hardcoded.
 */
export async function rephraseQuery(query) {
  const categories = await getCategories();
  const categoryList = categories
    .map(c => `"${c.path}" (${c.label})`)
    .join(', ');

  try {
    const completion = await executeGroqCall('rephraseQuery', {
      model: MODEL,
      temperature: 0,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content: `You help users post clear questions to the Samagama FAQ community.
Given a raw query, return:
1. A rephrased version that is grammatically correct, specific, and phrased as a clear question.
2. The best matching category path from this exact list: ${categoryList}

Respond ONLY as valid JSON:
{"rephrased": "...", "category_path": "root.xxx"}`,
        },
        { role: 'user', content: query },
      ],
    });

    const result = safeParseJSON(
      completion.choices[0]?.message?.content || '',
      { rephrased: query, category_path: 'root.about_the_internship' }
    );

    // Validate path against DB list
    const matched = categories.find(c => c.path === result.category_path);
    const categoryPath  = matched ? matched.path  : 'root.about_the_internship';
    const categoryLabel = matched ? matched.label : 'About the Internship';

    return {
      rephrased:      result.rephrased || query,
      category_path:  categoryPath,
      category_label: categoryLabel,
      // Legacy field kept for backward compat with any old callers
      category:       categoryPath,
    };
  } catch (error) {
    logger.error('Groq.rephraseQuery', error.message);
    return {
      rephrased:      query,
      category_path:  'root.about_the_internship',
      category_label: 'About the Internship',
      category:       'root.about_the_internship',
    };
  }
}


/**
 * Cluster community questions into Master FAQs
 */
export async function clusterQuestions(questionsData, customApiKey) {
  const client = customApiKey ? new Groq({ apiKey: customApiKey }) : getGroqClient();
  
  try {
    const completion = await executeGroqCall('clusterQuestions', {
      model: MODEL,
      temperature: 0,
      max_tokens: 4000, // Boosted to allow for large output structures
      messages: [
        {
          role: 'system',
          content: `You are an AI FAQ Generator and Moderation Expert for Samagama. 
Given a JSON list of user questions and their answers, your task is to group semantically similar questions together into clusters.
For each cluster, synthesize a comprehensive overview, flagging any inappropriate/repeated behaviour, and outputting a finalized "Master Question/Answer".

Respond ONLY with a valid JSON object matching this exact schema:
{
  "proposals": [
    {
      "clusterTitle": "A short, distinct title for this topic (e.g., 'NOC Upload Deadline')",
      "questionIds": ["id1", "id2"],
      "masterQuestion": "A synthesized, clear question",
      "masterAnswer": "A comprehensive answer combining details from the cluster",
      "category": "The best matching category (e.g., timing, noc, work)",
      "tags": ["tag1", "tag2"],
      "normalizedIntent": "A 3-5 word description of the user intent",
      "confidenceScore": 95, 
      "moderationStatus": "auto_approve | needs_review",
      "flaggedOrRepeated": ["Any specific questions that were abusive, toxic, or exact spam duplicates"],
      "shortSummary": "A 1-sentence summary of this cluster's importance"
    }
  ]
}

DO NOT wrap your response in markdown blocks like \`\`\`json. ONLY output the raw JSON object.`
        },
        {
          role: 'user',
          content: JSON.stringify(questionsData)
        }
      ]
    }, client);

    const rawContent = completion.choices[0]?.message?.content || '';
    
    // Fallback regex to extract JSON if it was accidentally wrapped in markdown
    let cleanContent = rawContent;
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanContent = jsonMatch[0];
    }

    const result = safeParseJSON(cleanContent, { proposals: [] });
    return result;
  } catch (error) {
    logger.error('Groq.clusterQuestions', error.message);
    return { proposals: [] };
  }
}

/**
 * Validate if a question matches the user-selected category.
 */
export async function validateCategory(question, category) {
  try {
    const completion = await executeGroqCall('validateCategory', {
      model: MODEL,
      temperature: 0,
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content: `You are an AI for Samagama verifying if a question matches a selected category.
Category: "${category}"
If the question is even slightly related to the category, return true.
If the question is completely irrelevant to the chosen category, return false.

Respond ONLY as valid JSON:
{"matches": true, "reason": ""}`
        },
        {
          role: 'user',
          content: `Question: ${question}`,
        },
      ],
    });

    const result = safeParseJSON(
      completion.choices[0]?.message?.content || '',
      { matches: true }
    );
    return { matches: result.matches !== false };
  } catch (error) {
    logger.error('Groq.validateCategory', error.message);
    return { matches: true }; // Fail open
  }
}

/**
 * Evaluates a community answer's quality and relevance to assign an SP reward.
 * Used by the Auto-Moderation queue.
 */
export async function evaluateAnswerReward(question, answer) {
  try {
    const completion = await executeGroqCall('evaluateAnswerReward', {
      model: MODEL,
      temperature: 0.1,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: `You are an expert AI moderator for the Samagama community.
Your job is to read a user's question and another user's answer, and judge the answer's quality.

Rules for rewards:
- If the answer is extremely detailed, helpful, and completely solves the question: give 15 SP, action "approve"
- If the answer is solid, correct, but standard: give 10 SP, action "approve"
- If the answer is barely acceptable, very brief, or low effort but not wrong: give 5 SP, action "approve"
- If the answer is irrelevant, spam, completely wrong, or harmful: give 0 SP, action "reject"

Asker reward:
- Give the asker 15 SP if the question is well-phrased. Otherwise 5 SP.

Respond ONLY as valid JSON:
{"action": "approve" | "reject", "answererXp": number, "askerXp": number, "reason": "short explanation"}`
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nAnswer: ${answer}`,
        },
      ],
    });

    const defaultResult = { action: 'approve', answererXp: 10, askerXp: 10, reason: 'Default fallback' };
    const result = safeParseJSON(completion.choices[0]?.message?.content || '', defaultResult);
    
    // Safety bounds
    if (result.action !== 'reject') result.action = 'approve';
    result.answererXp = Math.min(Math.max(result.answererXp || 0, 0), 15);
    result.askerXp = Math.min(Math.max(result.askerXp || 0, 0), 15);
    
    return result;
  } catch (error) {
    logger.error('Groq.evaluateAnswerReward', error.message);
    return { action: 'approve', answererXp: 5, askerXp: 5, reason: 'Error evaluating' };
  }
}

/**
 * Generate a hierarchical mind map tree for a FAQ section.
 * Returns a nested node tree suitable for SVG radial rendering.
 *
 * @param {string} sectionLabel - Human-readable section name (e.g. "NOC")
 * @param {Array<{question:string, answer:string}>} faqs - Array of FAQ items
 * @returns {Promise<{root:string, children:Array}>}
 */
export async function generateMindMap(sectionLabel, faqs) {
  const faqText = faqs
    .slice(0, 15) // cap to avoid token overflow
    .map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer.substring(0, 200)}`)
    .join('\n\n');

  const fallback = {
    root: sectionLabel,
    children: faqs.slice(0, 8).map((f, i) => ({
      id: `n${i}`,
      label: f.question.length > 55 ? f.question.substring(0, 52) + '…' : f.question,
      children: [],
    })),
  };

  try {
    const completion = await executeGroqCall('generateMindMap', {
      model: MODEL,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        {
          role: 'system',
          content: `You are a knowledge-mapping AI for the Samagama internship FAQ system.
Given a list of FAQs for a section, produce a radial mind-map tree in JSON.

Rules:
- The root node is the section name.
- Group related questions under 3-6 meaningful branch topics (level 1 children of root).
- Under each branch, list the actual FAQ questions as leaves (level 2). Keep labels concise (max 60 chars).
- Each node must have a unique string "id", a short "label", and a "children" array.
- Maximum depth is 3 (root → branch → leaf).
- Output ONLY raw JSON — no markdown, no explanation.

Schema:
{
  "root": "Section Name",
  "children": [
    {
      "id": "b1",
      "label": "Branch Topic",
      "children": [
        { "id": "b1l1", "label": "FAQ question (short)", "children": [] }
      ]
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Section: ${sectionLabel}\n\nFAQs:\n${faqText}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '';
    // Extract JSON object from the response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.root || !Array.isArray(parsed.children)) return fallback;

    return parsed;
  } catch (error) {
    logger.error('Groq.generateMindMap', error.message);
    return fallback;
  }
}

/**
 * checkQuestionSimilarity
 *
 * Uses Groq to determine whether a new question is semantically similar to any
 * existing FAQ or community question. Returns the best match with its answer so
 * the frontend can show it to the user before they post a duplicate.
 *
 * @param {string} newQuestion - The cleaned question being submitted
 * @param {{ question: string, answer?: string, source: 'faq'|'community', id?: string }[]} candidates
 *        - Top candidate questions fetched from vector search (max 10)
 * @returns {Promise<{
 *   isSimilar: boolean,
 *   match?: { question: string, answer?: string, source: string, id?: string },
 *   reason?: string
 * }>}
 */
export async function checkQuestionSimilarity(newQuestion, candidates) {
  if (!candidates || candidates.length === 0) {
    return { isSimilar: false };
  }

  const candidateList = candidates
    .map((c, i) => `[${i + 1}] (${c.source}) ${c.question}`)
    .join('\n');

  const systemPrompt = `You are a duplicate-detection assistant for an internship FAQ platform.
Your job: determine if the NEW QUESTION is semantically equivalent to or sufficiently answered by any candidate.

Respond ONLY with raw JSON in this exact schema:
{
  "isSimilar": true | false,
  "matchIndex": <1-based index of best match, or 0 if none>,
  "confidence": "high" | "medium" | "low",
  "reason": "<one sentence explaining why>"
}

Rules:
- "isSimilar" = true only when confidence is "high" or "medium".
- If the new question covers a different angle or asks for more specific detail not addressed by any candidate, return false.
- Do NOT consider generic phrasing differences as duplicates — focus on semantic intent.`;

  const userPrompt = `NEW QUESTION: "${newQuestion}"

CANDIDATES:
${candidateList}`;

  try {
    const completion = await executeGroqCall('checkQuestionSimilarity', {
      model: MODEL,
      temperature: 0,
      max_tokens: 256,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    const result = safeParseJSON(raw, { isSimilar: false, matchIndex: 0 });

    if (!result.isSimilar || !result.matchIndex || result.matchIndex < 1) {
      return { isSimilar: false };
    }

    const match = candidates[result.matchIndex - 1];
    return {
      isSimilar: true,
      match: {
        question: match.question,
        answer: match.answer || null,
        source: match.source,
        id: match.id || null,
      },
      reason: result.reason || '',
    };
  } catch (error) {
    logger.error('Groq.checkQuestionSimilarity', error.message);
    return { isSimilar: false };
  }
}

/**
 * checkQuestionRelevance
 *
 * Determines whether a user's question is genuinely related to the Samagama
 * internship platform — covering topics like: eligibility, NOC, certificates,
 * ViBe platform, Rosetta journal, teams, timeline, mentors, offer letters,
 * policies, support channels, and Yaksha AI.
 *
 * Off-topic examples (rejected):
 *   "I love you", "What's 2+2?", "Tell me a joke", "Who won the IPL?",
 *   "Can you help with my homework?", "I'm bored", etc.
 *
 * Fail-open: if Groq is unavailable, returns { relevant: true } so users
 * are not blocked by a service outage.
 *
 * @param {string} question - Cleaned question text
 * @returns {Promise<{ relevant: boolean, reason: string }>}
 */
export async function checkQuestionRelevance(question) {
  const systemPrompt = `You are a topic-relevance gatekeeper for an internship FAQ community board.
The platform is called Samagama/FAQ Quest — it is an online internship program run by VINS/VISE/VLED.

Topics that ARE relevant (accept):
- Internship eligibility, selection, program structure, duration, stipend
- NOC (No Objection Certificate) — signing, submitting, verifying
- Completion certificate / e-certificate / academic credit
- Rosetta daily journal / thinking routines / AI usage policy
- Team formation, team changes, WhatsApp groups
- Phase 1/2/3/4 projects, assignments, mentors, milestones
- ViBe learning platform — videos, coursework, bypass exam, DNS errors
- Offer letter acceptance, deferral, appeals
- Attendance, leave, mandatory live sessions, policies
- Yaksha AI chatbot — how to ask, escalate, tags
- Support channels — WhatsApp, email, TPO contact
- Timeline — start/end dates, kickoff, orientation, Zoom links
- General questions about the internship community board itself

Topics that are NOT relevant (reject):
- Personal expressions (love, anger, boredom, compliments)
- General knowledge or trivia (math, science, sports, news)
- Entertainment or jokes
- Homework / assignments unrelated to the internship
- Personal problems unrelated to the internship
- Random chit-chat or testing the system

Respond ONLY with raw JSON — no markdown, no explanation:
{ "relevant": true | false, "reason": "<one sentence>" }`;

  try {
    const completion = await executeGroqCall('checkQuestionRelevance', {
      model: MODEL,
      temperature: 0,
      max_tokens: 120,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Question: "${question}"` },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    const result = safeParseJSON(raw, { relevant: true });

    return {
      relevant: result.relevant !== false, // fail-open
      reason: result.reason || '',
    };
  } catch (error) {
    logger.warn('Groq.checkQuestionRelevance', `Check failed (fail-open): ${error.message}`);
    return { relevant: true, reason: '' }; // never block on Groq outage
  }
}
