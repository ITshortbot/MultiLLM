import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Load env variables manually for dev server context
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { queryGemini } = require('./workers/gemini.js');
const { queryClaude } = require('./workers/claude.js');
const { queryChatGPT } = require('./workers/chatgpt.js');
const { verifyResponses } = require('./services/verification/engine.js');
const { queryOllama, isOllamaAvailable } = require('./services/ollama/fallback.js');
const { saveQuery, getHistory, getById, clearHistory } = require('./services/history/store.js');
const { checkLimit, getSnapshot, resetSession } = require('./services/credits/tracker.js');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const apiPlugin = () => ({
  name: 'api-plugin',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url === '/api/credits' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(getSnapshot()));
      }
      if (req.url === '/api/credits/reset' && req.method === 'POST') {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(resetSession()));
      }
      if (req.url === '/api/history' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(getHistory(50)));
      }
      if (req.url === '/api/history/clear' && req.method === 'POST') {
        clearHistory();
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ success: true }));
      }
      if (req.url.startsWith('/api/history/') && req.method === 'GET') {
        const id = req.url.split('/').pop();
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(getById(id)));
      }
      if (req.url === '/api/query/run' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { question } = JSON.parse(body);
            const queryId = generateId();
            const timestamp = Date.now();

            const limitCheck = checkLimit();
            if (!limitCheck.allowed) {
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: limitCheck.reason }));
            }

            const mockStatus = () => {};
            const [geminiResult, claudeResult, chatgptResult] = await Promise.allSettled([
              queryGemini(question, mockStatus),
              queryClaude(question, mockStatus),
              queryChatGPT(question, mockStatus),
            ]);

            const errorResponse = (model, modelKey, reason) => ({
              model, modelKey, raw: '', timestamp: Date.now(),
              error: reason?.message || 'Unknown error',
              tokens: { input: 0, output: 0 }
            });

            const responses = [
              geminiResult.status  === 'fulfilled' ? geminiResult.value  : errorResponse('Gemini',  'gemini',  geminiResult.reason),
              claudeResult.status  === 'fulfilled' ? claudeResult.value  : errorResponse('Claude',  'claude',  claudeResult.reason),
              chatgptResult.status === 'fulfilled' ? chatgptResult.value : errorResponse('ChatGPT', 'chatgpt', chatgptResult.reason),
            ];

            const realResponses = responses.filter(r => !r.comingSoon && !r.error && r.raw);
            let verification = verifyResponses(realResponses);

            let ollamaRaw = null;
            if (verification.requiresOllama) {
              const available = await isOllamaAvailable();
              if (available) {
                const ollamaResult = await queryOllama(question, realResponses);
                ollamaRaw = ollamaResult?.raw || null;
                if (ollamaRaw) {
                  verification = verifyResponses(realResponses, ollamaRaw);
                }
              }
            }

            saveQuery({ id: queryId, question, timestamp, responses, ollamaRaw, verification });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, queryId }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }
      next();
    });
  }
});

export default defineConfig({
  plugins: [react(), apiPlugin()],
  root: 'client',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});

