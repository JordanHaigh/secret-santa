CREATE TABLE member_accounts (
  participant_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE CHECK (email = LOWER(email)),
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE member_sessions (
  token_hash TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES member_accounts(participant_id) ON DELETE CASCADE,
  setup_only BOOLEAN NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX member_sessions_participant_idx ON member_sessions (participant_id);
CREATE INDEX member_sessions_expiry_idx ON member_sessions (expires_at);
