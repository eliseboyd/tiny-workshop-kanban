CREATE TABLE IF NOT EXISTS quick_add_tokens (
  user_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
