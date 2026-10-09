CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  track TEXT NOT NULL CHECK (track IN ('EB', 'WB')),
  ring_number INTEGER NOT NULL,
  record_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS records_track_ring_idx
  ON records (track, ring_number, record_type);

CREATE TABLE IF NOT EXISTS project_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS change_log (
  revision INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('record', 'state')),
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
  track TEXT,
  changed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS change_log_revision_idx
  ON change_log (revision);

CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
