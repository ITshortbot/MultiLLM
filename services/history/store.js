/**
 * services/history/store.js
 * Pure-JS JSON file history store — no native dependencies required.
 * Stores query history as a JSON array in database/history.json.
 */

const path = require('path');
const fs = require('fs');

// Vercel's project filesystem is read-only; /tmp is writable but instance-local.
const DB_DIR = process.env.VERCEL
  ? '/tmp/multi-llm-verifier'
  : path.join(__dirname, '..', '..', 'database');
const DB_PATH = path.join(DB_DIR, 'history.json');

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, '[]', 'utf8');
  }
}

function readDb() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeDb(data) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Save a completed query to the store.
 */
function saveQuery(data) {
  const records = readDb();

  const record = {
    id: data.id,
    question: data.question,
    timestamp: data.timestamp || Date.now(),
    chatgpt_raw: data.responses?.find(r => r.modelKey === 'chatgpt')?.raw || '',
    gemini_raw: data.responses?.find(r => r.modelKey === 'gemini')?.raw || '',
    perplexity_raw: data.responses?.find(r => r.modelKey === 'perplexity')?.raw || '',
    ollama_raw: data.ollamaRaw || '',
    chatgpt_error: data.responses?.find(r => r.modelKey === 'chatgpt')?.error || null,
    gemini_error: data.responses?.find(r => r.modelKey === 'gemini')?.error || null,
    perplexity_error: data.responses?.find(r => r.modelKey === 'perplexity')?.error || null,
    verification_result: data.verification || {},
    final_answer: data.verification?.finalAnswer ?? null,
    final_unit: data.verification?.finalUnit || null,
    confidence: data.verification?.confidence ?? 0,
    verdict: data.verification?.verdict || 'error',
  };

  // Replace existing record with same ID, or prepend
  const idx = records.findIndex(r => r.id === data.id);
  if (idx !== -1) {
    records[idx] = record;
  } else {
    records.unshift(record); // newest first
  }

  // Keep last 200 records
  if (records.length > 200) records.splice(200);

  writeDb(records);
  return record;
}

/**
 * Get the last N queries ordered by timestamp descending.
 */
function getHistory(limit = 50) {
  const records = readDb();
  return records
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .map(r => ({
      id: r.id,
      question: r.question,
      timestamp: r.timestamp,
      final_answer: r.final_answer,
      final_unit: r.final_unit,
      confidence: r.confidence,
      verdict: r.verdict,
    }));
}

/**
 * Get a full query record by ID.
 */
function getById(id) {
  const records = readDb();
  return records.find(r => r.id === id) || null;
}

/**
 * Delete all history.
 */
function clearHistory() {
  writeDb([]);
}

module.exports = { saveQuery, getHistory, getById, clearHistory };
