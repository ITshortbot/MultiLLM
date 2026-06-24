/**
 * services/ollama/fallback.js
 * Ollama local LLM client — used as a tiebreaker when all 3 models disagree.
 */

const { OLLAMA_BASE_URL, OLLAMA_MODEL, TIMEOUTS } = require('../../shared/constants.js');

/**
 * Query Ollama with the given question.
 * @param {string} question - The original user question
 * @param {Array} previousResponses - Summary of what other models said (for context)
 * @returns {Promise<{raw: string, error: string|null}>}
 */
async function queryOllama(question, previousResponses = []) {
  try {
    // Build a verification-focused prompt
    const contextSummary = previousResponses
      .filter(r => r.raw)
      .map(r => `${r.model}: ${r.raw.slice(0, 200)}...`)
      .join('\n');

    const prompt = `You are a precise mathematical verifier. 
    
Question: ${question}

Other AI models gave these answers (which disagreed):
${contextSummary}

Please solve this step-by-step and provide the correct numerical answer. Be precise and show your work.`;

    const response = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,  // Low temp for precise math
          top_p: 0.9,
          num_predict: 500,
        },
      }),
    }, 60000);

    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      raw: data.response || '',
      error: null,
      model: `Ollama (${OLLAMA_MODEL})`,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { raw: '', error: 'Ollama request timed out.', model: `Ollama (${OLLAMA_MODEL})` };
    }
    return {
      raw: '',
      error: `Ollama unavailable: ${err.message}. Make sure Ollama is running (ollama serve).`,
      model: `Ollama (${OLLAMA_MODEL})`,
    };
  }
}

/**
 * Check if Ollama is running.
 */
async function isOllamaAvailable() {
  try {
    const response = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/tags`, {}, 3000);
    return response.ok;
  } catch {
    return false;
  }
}

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

module.exports = { queryOllama, isOllamaAvailable };
