/**
 * shared/constants.js — Shared configuration for the entire application.
 */

// ── LLM API Models ─────────────────────────────────────────────────────────────
const GEMINI_MODEL  = process.env.GEMINI_MODEL  || 'gemini-2.5-flash';
const CLAUDE_MODEL  = process.env.CLAUDE_MODEL  || 'claude-3-haiku-20240307';

// ── Pricing (USD per 1M tokens) ────────────────────────────────────────────────
const PRICING = {
  gemini: {
    // gemini-1.5-flash pricing
    inputPerMillion:  0.075,
    outputPerMillion: 0.30,
  },
  claude: {
    // claude-3-haiku pricing
    inputPerMillion:  0.25,
    outputPerMillion: 1.25,
  },
  chatgpt: {
    // GPT-4o-mini pricing (future)
    inputPerMillion:  0.15,
    outputPerMillion: 0.60,
  },
};

// ── Credit Limits ──────────────────────────────────────────────────────────────
const CREDIT_LIMIT_USD     = parseFloat(process.env.CREDIT_LIMIT_USD || '1.00');
const CREDIT_WARN_THRESHOLD = parseFloat(process.env.CREDIT_WARN_THRESHOLD || '0.75');

// ── Ollama ─────────────────────────────────────────────────────────────────────
const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_MODEL    = 'llama3';

// ── Timeouts (ms) ──────────────────────────────────────────────────────────────
const TIMEOUTS = {
  apiCall: 60000,        // API call timeout
  navigation: 30000,
  elementWait: 20000,
  responseStart: 60000,
  streamingComplete: 120000,
};

// ── Numerical Verification ─────────────────────────────────────────────────────
const NUMERICAL_TOLERANCE = 0.0001; // 0.01%

// ── Confidence Thresholds ──────────────────────────────────────────────────────
const CONFIDENCE = {
  ALL_AGREE:    0.95,
  TWO_AGREE:    0.80,
  NONE_AGREE:   0.40,
  OLLAMA_BOOST: 0.15,
};

const STATUS_LABELS = {
  idle:       'Idle',
  connecting: 'Connecting',
  querying:   'Querying',
  waiting:    'Waiting for response',
  extracting: 'Extracting answer',
  done:       'Done',
  error:      'Error',
  coming_soon: 'Coming Soon',
};

module.exports = {
  GEMINI_MODEL,
  CLAUDE_MODEL,
  PRICING,
  CREDIT_LIMIT_USD,
  CREDIT_WARN_THRESHOLD,
  OLLAMA_BASE_URL,
  OLLAMA_MODEL,
  TIMEOUTS,
  NUMERICAL_TOLERANCE,
  CONFIDENCE,
  STATUS_LABELS,
};
