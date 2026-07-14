-- BoardRoom user system: initial schema.
-- Conventions: TEXT ids (random 128-bit hex), UTC ISO timestamps,
-- JSON blobs for config payloads, FKs with cascade delete, indexes on
-- every foreign key / lookup path.

PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL COLLATE NOCASE UNIQUE,
  -- PBKDF2-SHA256; iterations stored so we can raise the cost later
  pass_hash     TEXT NOT NULL,
  pass_salt     TEXT NOT NULL,
  pass_iters    INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

-- Sessions store a HASH of the bearer token, never the token itself.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Saved bot/league setups
CREATE TABLE bot_configs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  teams       INTEGER NOT NULL,
  config_json TEXT NOT NULL, -- { bots: BotProfile[], globalBot: BotProfile }
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_bot_configs_user ON bot_configs(user_id, created_at);

-- Imported ranking lists (from Excel/CSV/link)
CREATE TABLE imported_rankings (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  note       TEXT,
  order_json TEXT NOT NULL, -- canonical player ids, best first
  created_at TEXT NOT NULL
);
CREATE INDEX idx_imported_rankings_user ON imported_rankings(user_id, created_at);

-- Completed drafts
CREATE TABLE drafts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  settings_json TEXT NOT NULL, -- LeagueSettings
  teams_json    TEXT NOT NULL, -- seat names + which was the user
  picks_json    TEXT NOT NULL, -- [{round, overall, teamIndex, playerId}]
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_drafts_user ON drafts(user_id, created_at);

-- One row of app preferences per user (active board, league settings, …)
CREATE TABLE user_prefs (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  prefs_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
