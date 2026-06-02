/**
 * questionSanitizer.js
 * Layer 1 — Pure regex/pattern question validation.
 *
 * No API calls. No external dependencies.
 * Returns { valid: boolean, cleaned?: string, reason?: string }
 *
 * Checks (in order):
 *  1. Empty / too short after stripping punctuation
 *  2. Greeting-only messages  (hi, hello, hey, sup, yo, ...)
 *  3. Elongated gibberish      (HHHEEElllooo, hellooooo, aaaa)
 *  4. Repeating single chars   (aaaaaaa, ??????, !!!!!!)
 *  5. All-punctuation / emoji-only
 *  6. Filler-word-only phrases (ok, okay, thanks, lol, test, ...)
 *  7. All-caps yelling with no real content
 *  8. Strip leading greeting prefix and return cleaned text
 */

/* ── Pattern library ─────────────────────────────────────────────────────── */

/**
 * Greeting words — matched case-insensitively at the start OR as the entire message.
 * Handles elongations via the elongation check below.
 */
const GREETING_WORDS = [
  'hi', 'hey', 'hello', 'helo', 'hii', 'hiii', 'sup', 'yo', 'howdy',
  'greetings', 'good morning', 'good afternoon', 'good evening',
  'good day', 'what\'s up', 'wassup', 'wazzup', 'namaste', 'salut',
  'hola', 'ola', 'ciao', 'bonjour',
];

/**
 * Filler phrases that carry no meaningful content.
 */
const FILLER_PHRASES = [
  'ok', 'okay', 'k', 'kk', 'kkk', 'alright', 'alrite',
  'thanks', 'thank you', 'ty', 'thx', 'thnx', 'tyvm',
  'lol', 'lmao', 'lmfao', 'rofl', 'haha', 'hehe', 'hihi',
  'test', 'testing', '123', 'asdf', 'qwerty',
  'idk', 'idc', 'brb', 'gtg', 'omg', 'wtf', 'smh',
  'yes', 'no', 'yep', 'nope', 'nah', 'yea', 'yeah',
  'bye', 'goodbye', 'cya', 'see ya',
  'help', 'help me', 'please help', 'pls help', 'plz help',
  'anyone there', 'anyone here', 'is anyone there',
];

/**
 * Prefix greetings to strip before re-evaluating the remaining text.
 * e.g. "Hey, when does the internship start?" → "when does the internship start?"
 */
const GREETING_PREFIX_RE = new RegExp(
  `^(?:${[
    'hi+[\\s,!.]*', 'hey+[\\s,!.]*', 'hello+[\\s,!.]*', 'helo+[\\s,!.]*',
    'sup[\\s,!.]*', 'yo[\\s,!.]*', 'howdy[\\s,!.]*',
    'good\\s+(?:morning|afternoon|evening|day)[\\s,!.]*',
    'what\'?s\\s+up[\\s,!.]*', 'wassup[\\s,!.]*', 'wazzup[\\s,!.]*',
    'namaste[\\s,!.]*', 'hola[\\s,!.]*', 'ciao[\\s,!.]*',
    'greetings[\\s,!.]*', 'salut[\\s,!.]*', 'bonjour[\\s,!.]*',
  ].join('|')})`,
  'i'
);

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/** Normalize a string: collapse whitespace, trim. */
const normalize = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * Detects character elongation / gibberish.
 * Triggers when the same character is repeated 3+ times consecutively anywhere
 * in the message (e.g. heeello, aaaa, HHHHi, ???!!?).
 */
const hasElongation = (text) => /(.)\1{2,}/i.test(text);

/**
 * Detects messages that are entirely punctuation / symbols / emoji.
 */
const isPunctuationOnly = (text) => /^[\s\W]+$/u.test(text);

/**
 * Detects all-caps with no real question indicators.
 * Triggers when ALL alphabetic characters are uppercase AND there are no
 * question-forming words (what, how, why, when, where, is, can, does, …)
 */
const isAllCapsGibberish = (text) => {
  const alphaOnly = text.replace(/\W/g, '');
  if (alphaOnly.length < 4) return false;
  if (alphaOnly !== alphaOnly.toUpperCase()) return false;
  // Allow if it contains question-intent keywords
  const lower = text.toLowerCase();
  const questionKeywords = [
    'what', 'how', 'why', 'when', 'where', 'which', 'who', 'whom',
    'is', 'are', 'can', 'could', 'will', 'would', 'should', 'do',
    'does', 'did', 'have', 'has', 'tell', 'explain', 'describe',
  ];
  return !questionKeywords.some((kw) => lower.includes(kw));
};

/* ── Main exported function ───────────────────────────────────────────────── */

/**
 * Validates and sanitizes a raw question string.
 *
 * @param {string} rawInput - The text typed by the user
 * @returns {{ valid: boolean, cleaned?: string, reason?: string }}
 *
 * `valid: false` → caller should reject the submission with `reason`.
 * `valid: true`  → caller should use `cleaned` as the sanitized question.
 */
export function sanitizeQuestion(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { valid: false, reason: 'Please enter a question.' };
  }

  // ── Step 1: Basic length check ───────────────────────────────────────────
  const trimmed = normalize(rawInput);
  if (trimmed.length < 10) {
    return { valid: false, reason: 'Your question is too short. Please provide more detail.' };
  }

  // ── Step 2: Punctuation / emoji only ────────────────────────────────────
  if (isPunctuationOnly(trimmed)) {
    return { valid: false, reason: 'Please type an actual question — symbols and emoji are not enough.' };
  }

  // ── Step 3: Elongated characters / gibberish ────────────────────────────
  // Check the full string first — catches HHHEEEllooooo even when withoutGreeting is long enough
  const withoutGreeting = trimmed.replace(GREETING_PREFIX_RE, '').replace(/^[,\s]+/, '').trim();
  if (hasElongation(trimmed)) {
    // If there's nothing meaningful left after stripping greetings, it's pure gibberish
    if (withoutGreeting.length < 10) {
      return {
        valid: false,
        reason: 'That looks like a greeting or gibberish (repeated characters). Please ask a real question.',
      };
    }
    // If elongation is only in the greeting part and there's a real question, allow it
    if (!hasElongation(withoutGreeting)) {
      // continue to step 4 with withoutGreeting
    } else {
      return {
        valid: false,
        reason: 'Your message contains excessive repeated characters. Please type normally.',
      };
    }
  }

  // ── Step 4: Greeting-only detection ────────────────────────────────────
  // After stripping punctuation/whitespace, does the entire message match a greeting?
  const stripped = trimmed.replace(/[!?.,'"\-]+$/g, '').trim().toLowerCase();
  if (GREETING_WORDS.some((g) => stripped === g || stripped === g.replace(/\s+/g, ''))) {
    return {
      valid: false,
      reason: `"${trimmed}" is a greeting, not a question. Please ask something specific about the internship.`,
    };
  }

  // ── Step 5: Filler phrase detection ────────────────────────────────────
  if (FILLER_PHRASES.some((f) => stripped === f)) {
    return {
      valid: false,
      reason: 'That doesn\'t look like a question. Please describe what you\'d like to know.',
    };
  }

  // ── Step 6: All-caps gibberish ──────────────────────────────────────────
  if (isAllCapsGibberish(trimmed)) {
    return {
      valid: false,
      reason: 'Please write your question in proper sentence case — all-caps is hard to read.',
    };
  }

  // ── Step 7: Strip greeting prefix and return cleaned text ───────────────
  const cleaned = withoutGreeting.length >= 10 ? withoutGreeting : trimmed;

  // Final length check after stripping
  if (cleaned.length < 10) {
    return {
      valid: false,
      reason: 'Your question is too short after removing the greeting. Please add more detail.',
    };
  }

  return { valid: true, cleaned: normalize(cleaned) };
}
