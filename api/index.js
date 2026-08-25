const crypto = require('crypto');
const { queryChatGPT } = require('../workers/chatgpt.js');
const { queryGemini } = require('../workers/gemini.js');
const { queryClaude } = require('../workers/claude.js');
const { verifyResponses } = require('../services/verification/engine.js');
const { queryOllama, isOllamaAvailable } = require('../services/ollama/fallback.js');
const { saveQuery, getHistory, getById, clearHistory } = require('../services/history/store.js');
const { checkLimit, getSnapshot, resetSession } = require('../services/credits/tracker.js');

function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function runQuery(question) {
  const queryId = generateId();
  const timestamp = Date.now();
  const limitCheck = checkLimit();
  if (!limitCheck.allowed) return { success: false, error: limitCheck.reason };

  const results = await Promise.allSettled([
    queryGemini(question, () => {}),
    queryClaude(question, () => {}),
    queryChatGPT(question, () => {}),
  ]);
  const errorResponse = (model, modelKey, reason) => ({
    model, modelKey, raw: '', timestamp: Date.now(),
    error: reason?.message || 'Unknown error',
    tokens: { input: 0, output: 0 },
  });
  const responses = [
    results[0].status === 'fulfilled' ? results[0].value : errorResponse('Gemini', 'gemini', results[0].reason),
    results[1].status === 'fulfilled' ? results[1].value : errorResponse('Claude', 'claude', results[1].reason),
    results[2].status === 'fulfilled' ? results[2].value : errorResponse('ChatGPT', 'chatgpt', results[2].reason),
  ];

  const realResponses = responses.filter(response => !response.comingSoon && !response.error && response.raw);
  let verification = verifyResponses(realResponses);
  let ollamaRaw = null;
  let ollamaResult = null;
  if (verification.requiresOllama && await isOllamaAvailable()) {
    ollamaResult = await queryOllama(question, realResponses);
    ollamaRaw = ollamaResult?.raw || null;
    if (ollamaRaw) verification = verifyResponses(realResponses, ollamaRaw);
  }

  saveQuery({ id: queryId, question, timestamp, responses, ollamaRaw, verification });
  return { success: true, queryId, question, timestamp, responses, verification, ollamaResult };
}

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/credits' && req.method === 'GET') return sendJson(res, 200, getSnapshot());
    if (url.pathname === '/api/credits/reset' && req.method === 'POST') return sendJson(res, 200, resetSession());
    if (url.pathname === '/api/history' && req.method === 'GET') return sendJson(res, 200, getHistory(50));
    if (url.pathname === '/api/history/clear' && req.method === 'POST') {
      clearHistory();
      return sendJson(res, 200, { success: true });
    }
    if (url.pathname.startsWith('/api/history/') && req.method === 'GET') {
      return sendJson(res, 200, getById(url.pathname.split('/').pop()));
    }
    if (url.pathname === '/api/query/run' && req.method === 'POST') {
      const { question } = JSON.parse(await readBody(req));
      if (typeof question !== 'string' || !question.trim()) {
        return sendJson(res, 400, { success: false, error: 'A question is required.' });
      }
      return sendJson(res, 200, await runQuery(question.trim()));
    }
    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error('[API]', error);
    return sendJson(res, 500, { success: false, error: error.message });
  }
};