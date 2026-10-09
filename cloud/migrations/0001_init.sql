-- Sector Defense cloud schema v1.
-- One account per device (generated client-side, secret hashed at rest),
-- one save blob per account (last-write-wins by client timestamp), append
-- only scores for leaderboards.

CREATE TABLE IF NOT EXISTS accounts (
  user_id      TEXT PRIMARY KEY,          -- 12 hex chars, client generated
  secret_hash  TEXT NOT NULL,             -- sha256(secret + ':' + user_id)
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saves (
  user_id     TEXT PRIMARY KEY,
  blob        TEXT NOT NULL,              -- full client state as JSON
  updated_at  INTEGER NOT NULL,           -- client wall clock, LWW arbiter
  bytes       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  map_id     TEXT NOT NULL,
  diff_id    TEXT NOT NULL,
  score      INTEGER NOT NULL,            -- wave*10 + stars
  wave       INTEGER NOT NULL,
  victory    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scores_board ON scores(map_id, diff_id, score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_scores_user_rate ON scores(user_id, created_at DESC);
