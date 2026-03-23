CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_name_ci ON spaces (lower(name));

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  tags TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai', 'anki')),
  state INTEGER NOT NULL DEFAULT 0,
  due INTEGER NOT NULL,
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  elapsed_days INTEGER NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  last_review INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cards_queue ON cards (space_id, state, due);

CREATE TABLE IF NOT EXISTS review_logs (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  space_id TEXT NOT NULL,
  grade INTEGER NOT NULL,
  state INTEGER NOT NULL,
  due INTEGER NOT NULL,
  elapsed_days INTEGER,
  scheduled_days INTEGER,
  review_time INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_logs_stats ON review_logs (space_id, review_time);

CREATE TABLE IF NOT EXISTS study_days (
  space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE,
  day TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_study_days_scope_day ON study_days (ifnull(space_id, ''), day);
CREATE INDEX IF NOT EXISTS idx_study_days_streak ON study_days (space_id, day);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
