CREATE TABLE exchange_state (
  id TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  expires BIGINT NOT NULL
);
CREATE INDEX rate_limits_expires_idx ON rate_limits (expires);
