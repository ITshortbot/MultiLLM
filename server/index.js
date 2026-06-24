/**
 * server/index.js — Electron ipcMain handler registration.
 * Orchestrates concurrent LLM queries, verification, and history storage.
 */

const { ipcMain } = require('electron');
const crypto = require('crypto');
const { queryChatGPT } = require('../workers/chatgpt.js');
const { queryGemini }  = require('../workers/gemini.js');
const { queryClaude }  = require('../workers/claude.js');
const { verifyResponses } = require('../services/verification/engine.js');
const { queryOllama, isOllamaAvailable } = require('../services/ollama/fallback.js');
const { saveQuery, getHistory, getById, clearHistory } = require('../services/history/store.js');
const { checkLimit, getSnapshot, recordUsage, resetSession } = require('../services/credits/tracker.js');

function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : (Date.now().toString(36) + Math.random().toString(36).slice(2));
}

function registerHandlers(mainWindow) {
  const send = (channel, data) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
  };

  // ── Main Query Handler ───────────────────────────────────────────────────────
  ipcMain.handle('query:run', async (event, question) => {
    const queryId   = generateId();
    const timestamp = Date.now();

    const sendStatus = (data) => send('status:update', { ...data, queryId });

    // 1. Check credit limit before starting
    const limitCheck = checkLimit();
    if (!limitCheck.allowed) {
      send('query:error', {
        queryId,
        error: limitCheck.reason,
        credits: getSnapshot(),
      });
      return { success: false, error: limitCheck.reason };
    }

    // Warn if approaching limit
    if (limitCheck.isWarning) {
      send('credits:warning', { message: limitCheck.reason, credits: getSnapshot() });
    }

    try {
      sendStatus({ phase: 'started', message: 'Querying models...' });

      // 2. Run Gemini + Claude concurrently; ChatGPT is instant (coming soon)
      const [geminiResult, claudeResult, chatgptResult] = await Promise.allSettled([
        queryGemini(question,  (s) => sendStatus(s)),
        queryClaude(question,  (s) => sendStatus(s)),
        queryChatGPT(question, (s) => sendStatus(s)),
      ]);

      const responses = [
        geminiResult.status  === 'fulfilled' ? geminiResult.value  : errorResponse('Gemini',  'gemini',  geminiResult.reason),
        claudeResult.status  === 'fulfilled' ? claudeResult.value  : errorResponse('Claude',  'claude',  claudeResult.reason),
        chatgptResult.status === 'fulfilled' ? chatgptResult.value : errorResponse('ChatGPT', 'chatgpt', chatgptResult.reason),
      ];

      // Send raw results so UI can start rendering immediately
      send('result:ready', { queryId, responses });

      // 3. Emit updated credits snapshot
      send('credits:update', getSnapshot());

      sendStatus({ phase: 'verifying', message: 'Running verification engine...' });

      // 4. Verify — only use real responses (skip coming-soon / errors)
      const realResponses = responses.filter(r => !r.comingSoon && !r.error && r.raw);
      let verification = verifyResponses(realResponses);

      // 5. Ollama fallback if all disagree
      let ollamaRaw    = null;
      let ollamaResult = null;

      if (verification.requiresOllama) {
        sendStatus({ phase: 'ollama', message: 'All models disagree — querying Ollama...' });
        const available = await isOllamaAvailable();
        if (available) {
          ollamaResult = await queryOllama(question, realResponses);
          ollamaRaw    = ollamaResult?.raw || null;
          if (ollamaRaw) {
            verification = verifyResponses(realResponses, ollamaRaw);
          }
        } else {
          sendStatus({ phase: 'ollama-unavailable', message: 'Ollama not running — skipping fallback.' });
        }
      }

      // 6. Save to history
      saveQuery({ id: queryId, question, timestamp, responses, ollamaRaw, verification });

      const finalResult = { queryId, question, timestamp, responses, verification, ollamaResult };
      send('verification:complete', finalResult);
      send('credits:update', getSnapshot());

      return { success: true, queryId };
    } catch (err) {
      console.error('[Server] Query error:', err);
      send('query:error', { queryId, error: err.message });
      return { success: false, error: err.message };
    }
  });

  // ── History Handlers ─────────────────────────────────────────────────────────
  ipcMain.handle('history:get',     (_, limit = 50)  => { try { return getHistory(limit); } catch { return []; } });
  ipcMain.handle('history:getById', (_, id)          => { try { return getById(id);       } catch { return null; } });
  ipcMain.handle('history:clear',   ()               => { try { clearHistory(); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });

  // ── Credits Handlers ─────────────────────────────────────────────────────────
  ipcMain.handle('credits:get',   () => getSnapshot());
  ipcMain.handle('credits:reset', () => resetSession());

  // ── Window Controls ──────────────────────────────────────────────────────────
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); });
  ipcMain.on('window:close',    () => mainWindow?.close());

  console.log('[Server] IPC handlers registered.');
}

function errorResponse(model, modelKey, reason) {
  return {
    model, modelKey, raw: '', timestamp: Date.now(),
    error: reason?.message || 'Unknown error',
    tokens: { input: 0, output: 0 },
  };
}

module.exports = { registerHandlers };
