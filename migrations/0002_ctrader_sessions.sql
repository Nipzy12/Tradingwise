-- Tokens are stored AES-256-GCM encrypted; session cookies contain only random identifiers.
CREATE TABLE IF NOT EXISTS ctrader_sessions (
 id_hash TEXT PRIMARY KEY,
 token_ciphertext TEXT NOT NULL,
 access_expires_at INTEGER NOT NULL,
 session_expires_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ctrader_sessions_expiry ON ctrader_sessions(session_expires_at);