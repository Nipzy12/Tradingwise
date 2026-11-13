-- Cloudflare D1 free scheduled SMC alerts. No tokens or webhook URLs are persisted.
CREATE TABLE IF NOT EXISTS alert_rules (
 id TEXT PRIMARY KEY,
 symbol TEXT NOT NULL,
 interval TEXT NOT NULL,
 types TEXT NOT NULL,
 settings TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1,
 cursor INTEGER NOT NULL DEFAULT 0,
 last_error TEXT,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rules_active ON alert_rules(active, created_at);
CREATE TABLE IF NOT EXISTS alert_events (
 id TEXT PRIMARY KEY,
 rule_id TEXT NOT NULL,
 candle_time INTEGER NOT NULL,
 payload TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0,
 next_try INTEGER,
 last_error TEXT,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_due ON alert_events(status,next_try);
CREATE INDEX IF NOT EXISTS idx_alert_created ON alert_events(created_at DESC);