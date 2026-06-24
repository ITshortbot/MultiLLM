/**
 * workers/gemini.js — Google Gemini API worker.
 * Uses @google/generative-ai SDK with gemini-1.5-flash (fast + cheap).
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { recordUsage } = require('../services/credits/tracker.js');
const { GEMINI_MODEL, TIMEOUTS } = require('../shared/constants.js');

let genAI = null;

function getClient() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

async function queryGemini(question, onStatus) {
  const modelKey = 'gemini';
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    onStatus({ model: modelKey, status: 'connecting' });

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
    }

    onStatus({ model: modelKey, status: 'querying' });

    const prompt = buildPrompt(question);

    // Call Gemini API via fetch (this works reliably with any key tier and avoids SDK version mismatch)
    const res = await withTimeout(
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          }
        })
      }),
      TIMEOUTS.apiCall,
      'Gemini API timed out'
    );

    if (!res.ok) {
      // If v1beta fails, fallback to v1 endpoint
      const fallbackRes = await withTimeout(
        fetch(`https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024,
            }
          })
        }),
        TIMEOUTS.apiCall,
        'Gemini API timed out'
      );
      if (!fallbackRes.ok) {
        const errText = await fallbackRes.text();
        throw new Error(`Gemini HTTP error: ${errText}`);
      }
      const data = await fallbackRes.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usage = data.usageMetadata;
      if (usage) {
        recordUsage(modelKey, usage.promptTokenCount || 0, usage.candidatesTokenCount || 0);
      }
      onStatus({ model: modelKey, status: 'done' });
      return {
        model: 'Gemini',
        modelKey: 'gemini',
        raw,
        timestamp: Date.now(),
        error: null,
        tokens: {
          input: usage?.promptTokenCount || 0,
          output: usage?.candidatesTokenCount || 0,
        }
      };
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    onStatus({ model: modelKey, status: 'extracting' });

    const usage = data.usageMetadata;
    if (usage) {
      recordUsage(modelKey, usage.promptTokenCount || 0, usage.candidatesTokenCount || 0);
    }

    onStatus({ model: modelKey, status: 'done' });

    return {
      model:    'Gemini',
      modelKey: 'gemini',
      raw,
      timestamp: Date.now(),
      error: null,
      tokens: {
        input:  usage?.promptTokenCount     || 0,
        output: usage?.candidatesTokenCount || 0,
      },
    };

  } catch (err) {

    onStatus({ model: modelKey, status: 'error', message: err.message });
    return {
      model:    'Gemini',
      modelKey: 'gemini',
      raw:      '',
      timestamp: Date.now(),
      error:    err.message,
      tokens:   { input: 0, output: 0 },
    };
  }
}

function buildPrompt(question) {
  return `You are a precise mathematical and analytical assistant. Solve the following problem step by step.

Show your work clearly:
1. Identify the approach / formula
2. Substitute values
3. Calculate step by step
4. State the final answer clearly with units

Problem: ${question}

Provide a clear, accurate numerical answer. Be concise but complete.`;
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

module.exports = { queryGemini };
