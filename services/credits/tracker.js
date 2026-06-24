/**
 * services/credits/tracker.js
 * Session-level credit (token + cost) tracker.
 * Tracks usage per model and blocks queries when the limit is reached.
 */

const { PRICING, CREDIT_LIMIT_USD, CREDIT_WARN_THRESHOLD } = require('../../shared/constants.js');

// In-memory session state
const sessionUsage = {
  gemini: { inputTokens: 0, outputTokens: 0, cost: 0, queries: 0 },
  claude: { inputTokens: 0, outputTokens: 0, cost: 0, queries: 0 },
  chatgpt: { inputTokens: 0, outputTokens: 0, cost: 0, queries: 0 },
};

let sessionStart = Date.now();

/**
 * Record token usage for a completed API call.
 * @param {'gemini'|'claude'|'chatgpt'} modelKey
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {object} updated model usage + total session cost
 */
function recordUsage(modelKey, inputTokens, outputTokens) {
  const pricing = PRICING[modelKey];
  if (!pricing || !sessionUsage[modelKey]) return getSnapshot();

  const callCost =
    (inputTokens  / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion;

  sessionUsage[modelKey].inputTokens  += inputTokens;
  sessionUsage[modelKey].outputTokens += outputTokens;
  sessionUsage[modelKey].cost         += callCost;
  sessionUsage[modelKey].queries      += 1;

  return getSnapshot();
}

/**
 * Get total session cost across all models.
 */
function getTotalCost() {
  return Object.values(sessionUsage).reduce((sum, m) => sum + m.cost, 0);
}

/**
 * Check if a query can proceed within credit limits.
 * @returns {{ allowed: boolean, reason: string|null, totalCost: number, limitUSD: number }}
 */
function checkLimit() {
  const totalCost = getTotalCost();
  const allowed   = totalCost < CREDIT_LIMIT_USD;
  const pct       = totalCost / CREDIT_LIMIT_USD;
  const isWarning = pct >= CREDIT_WARN_THRESHOLD && allowed;

  return {
    allowed,
    isWarning,
    reason: allowed
      ? (isWarning ? `⚠ Approaching credit limit ($${totalCost.toFixed(4)} / $${CREDIT_LIMIT_USD})` : null)
      : `Credit limit reached ($${totalCost.toFixed(4)} / $${CREDIT_LIMIT_USD}). Reset session to continue.`,
    totalCost,
    limitUSD: CREDIT_LIMIT_USD,
    usagePct: Math.min(100, Math.round(pct * 100)),
  };
}

/**
 * Get a snapshot of current session usage.
 */
function getSnapshot() {
  const totalCost   = getTotalCost();
  const limitCheck  = checkLimit();
  const totalTokens = Object.values(sessionUsage).reduce(
    (acc, m) => ({ input: acc.input + m.inputTokens, output: acc.output + m.outputTokens }),
    { input: 0, output: 0 }
  );

  return {
    models: { ...sessionUsage },
    totalCost,
    totalInputTokens:  totalTokens.input,
    totalOutputTokens: totalTokens.output,
    limitUSD: CREDIT_LIMIT_USD,
    usagePct: limitCheck.usagePct,
    isWarning: limitCheck.isWarning,
    isBlocked: !limitCheck.allowed,
    sessionStart,
  };
}

/**
 * Reset session usage (e.g. user manually resets).
 */
function resetSession() {
  for (const key of Object.keys(sessionUsage)) {
    sessionUsage[key] = { inputTokens: 0, outputTokens: 0, cost: 0, queries: 0 };
  }
  sessionStart = Date.now();
  return getSnapshot();
}

module.exports = { recordUsage, checkLimit, getSnapshot, resetSession, getTotalCost };
