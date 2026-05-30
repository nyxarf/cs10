/**
 * Groq LLM service wrapper
 * Model: llama-3.1-8b-instant
 * All calls use temperature: 0 for deterministic output
 */

import Groq from 'groq-sdk';

const apiKey = process.env.GROQ_API_KEY || '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';
const groq = new Groq({ apiKey });
const MODEL = 'llama-3.1-8b-instant';

import GroqLog from '../models/GroqLog.js';

async function executeGroqCall(actionName, options, customClient = groq) {
  try {
    const completion = await customClient.chat.completions.create(options);
    
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
    }).catch(err => console.error('Failed to log Groq:', err.message));

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
        console.error('⚠️ Regex JSON recovery failed:', regexError.message);
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
    console.error('⚠️ Groq classifyQuery error:', error.message);
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
    console.error('⚠️ Groq classifyForPosting error:', error.message);
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
    console.log(`💬 Query condensed: "${query}" ➡️ "${result}"`);
    return result || query;
  } catch (error) {
    console.error('⚠️ Groq condenseQuery error:', error.message);
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
    console.error('⚠️ Groq synthesizeAnswer error:', error.message);
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
    console.error('⚠️ Groq checkAnswer error:', error.message);
    // Default to passes: true on failure to avoid blocking valid answers
    return { passes: true, flag_reason: null };
  }
}

/**
 * US-008: Rephrase a raw query into a clear, categorized question.
 */
export async function rephraseQuery(query) {
  try {
    const completion = await executeGroqCall('rephraseQuery', {
      model: MODEL,
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: `You help users post clear questions to the Samagama FAQ community.
Given a raw query, return:
1. A rephrased version that is grammatically correct, specific, and phrased as a clear question.
2. The best matching category from this exact list: about, timing, noc, selection, work, conduct, certificate, interviews, general.

Respond ONLY as valid JSON:
{"rephrased": "...", "category": "..."}`
        },
        {
          role: 'user',
          content: query,
        },
      ],
    });

    const result = safeParseJSON(
      completion.choices[0]?.message?.content || '',
      { rephrased: query, category: 'general' }
    );

    // Validate category against allowed list
    const validCategories = ['about', 'timing', 'noc', 'selection', 'work', 'conduct', 'certificate', 'interviews', 'general'];
    const category = validCategories.includes(result.category?.toLowerCase())
      ? result.category.toLowerCase()
      : 'general';

    return {
      rephrased: result.rephrased || query,
      category,
    };
  } catch (error) {
    console.error('⚠️ Groq rephraseQuery error:', error.message);
    return { rephrased: query, category: 'general' };
  }
}

/**
 * Cluster community questions into Master FAQs
 */
export async function clusterQuestions(questionsData, customApiKey) {
  const client = customApiKey ? new Groq({ apiKey: customApiKey }) : groq;
  
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
    console.error('⚠️ Groq clusterQuestions error:', error.message);
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
    console.error('⚠️ Groq validateCategory error:', error.message);
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
    console.error('⚠️ Groq evaluateAnswerReward error:', error.message);
    return { action: 'approve', answererXp: 5, askerXp: 5, reason: 'Error evaluating' };
  }
}
