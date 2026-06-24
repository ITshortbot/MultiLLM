-- Multi-LLM Verifier — SQLite Schema

CREATE TABLE IF NOT EXISTS queries (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  chatgpt_raw TEXT DEFAULT '',
  gemini_raw TEXT DEFAULT '',
  perplexity_raw TEXT DEFAULT '',
  ollama_raw TEXT DEFAULT '',
  chatgpt_error TEXT,
  gemini_error TEXT,
  perplexity_error TEXT,
  verification_result TEXT,  -- JSON blob of full VerificationResult
  final_answer REAL,
  final_unit TEXT,
  confidence INTEGER,        -- 0-100
  verdict TEXT               -- 'unanimous' | 'majority' | 'contested' | 'ollama-confirmed' | 'error'
);

CREATE INDEX IF NOT EXISTS idx_queries_timestamp ON queries (timestamp DESC);
