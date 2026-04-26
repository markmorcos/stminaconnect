/**
 * Initial local schema. Mirrors the server projections documented by
 * `public.sync_local_projection` in `017_sync_rpcs.sql`. Every mirror
 * table carries a `sync_status` column ('synced' | 'pending' |
 * 'needs_attention') that the SyncEngine flips as ops drain.
 *
 * `local_sync_queue` is a true append-only queue with autoincrement
 * ids. FIFO drain order is `id asc`.
 *
 * `sync_meta` is a key/value bag for `last_pull_at`, `schema_version`,
 * etc. so future migrations don't need new tables.
 */
export const sql = `
CREATE TABLE IF NOT EXISTS persons (
  id                 TEXT PRIMARY KEY,
  first_name         TEXT NOT NULL,
  last_name          TEXT NOT NULL,
  phone              TEXT,
  region             TEXT,
  language           TEXT NOT NULL,
  priority           TEXT NOT NULL,
  assigned_servant   TEXT NOT NULL,
  comments           TEXT,
  status             TEXT NOT NULL,
  paused_until       TEXT,
  registration_type  TEXT NOT NULL,
  registered_by      TEXT NOT NULL,
  registered_at      TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  deleted_at         TEXT,
  sync_status        TEXT NOT NULL DEFAULT 'synced'
);

CREATE INDEX IF NOT EXISTS persons_assigned_idx ON persons (assigned_servant);
CREATE INDEX IF NOT EXISTS persons_status_idx   ON persons (status);
CREATE INDEX IF NOT EXISTS persons_active_idx   ON persons (id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  google_event_id TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  start_at        TEXT NOT NULL,
  end_at          TEXT NOT NULL,
  is_counted      INTEGER NOT NULL DEFAULT 0,
  synced_at       TEXT NOT NULL,
  sync_status     TEXT NOT NULL DEFAULT 'synced'
);

CREATE INDEX IF NOT EXISTS events_start_idx ON events (start_at);

CREATE TABLE IF NOT EXISTS attendance (
  event_id    TEXT NOT NULL,
  person_id   TEXT NOT NULL,
  marked_by   TEXT NOT NULL,
  marked_at   TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  PRIMARY KEY (event_id, person_id)
);

CREATE INDEX IF NOT EXISTS attendance_event_idx  ON attendance (event_id);
CREATE INDEX IF NOT EXISTS attendance_person_idx ON attendance (person_id);

CREATE TABLE IF NOT EXISTS notifications (
  id                    TEXT PRIMARY KEY,
  recipient_servant_id  TEXT NOT NULL,
  type                  TEXT NOT NULL,
  payload               TEXT NOT NULL DEFAULT '{}',
  read_at               TEXT,
  created_at            TEXT NOT NULL,
  sync_status           TEXT NOT NULL DEFAULT 'synced'
);

CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications (recipient_servant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx    ON notifications (recipient_servant_id) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS local_sync_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  op_type     TEXT NOT NULL,
  payload     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  temp_id     TEXT
);

CREATE INDEX IF NOT EXISTS queue_status_idx ON local_sync_queue (status);
CREATE INDEX IF NOT EXISTS queue_temp_id_idx ON local_sync_queue (temp_id);

CREATE TABLE IF NOT EXISTS sync_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;
