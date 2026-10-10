/**
 * Schema migrations. Each entry upgrades `PRAGMA user_version` by one.
 * Never edit a shipped migration; append a new one.
 */
export const MIGRATIONS: string[] = [
  `
  PRAGMA foreign_keys = ON;

  CREATE TABLE cases (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    reference TEXT,
    matter_date TEXT,
    notes TEXT,
    next_exhibit_number INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE exhibits (
    id TEXT PRIMARY KEY NOT NULL,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    captured_at TEXT NOT NULL,
    capture_digest TEXT NOT NULL,
    current_version_id TEXT,
    ocr_status TEXT NOT NULL DEFAULT 'pending',
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (case_id, number)
  );
  CREATE INDEX exhibits_case ON exhibits(case_id, number);

  CREATE TABLE pages (
    id TEXT PRIMARY KEY NOT NULL,
    exhibit_id TEXT NOT NULL REFERENCES exhibits(id) ON DELETE CASCADE,
    page_index INTEGER NOT NULL,
    original_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    bytes INTEGER NOT NULL,
    ocr_text TEXT,
    ocr_lines TEXT,
    UNIQUE (exhibit_id, page_index)
  );

  CREATE TABLE versions (
    id TEXT PRIMARY KEY NOT NULL,
    exhibit_id TEXT NOT NULL REFERENCES exhibits(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    kind TEXT NOT NULL,
    parent_version_id TEXT REFERENCES versions(id),
    file_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    description TEXT NOT NULL,
    annotations TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (exhibit_id, version)
  );

  CREATE TABLE custody_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exhibit_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    device_model TEXT NOT NULL,
    os_name TEXT NOT NULL,
    os_version TEXT NOT NULL,
    app_version TEXT NOT NULL,
    app_build TEXT NOT NULL,
    file_sha256 TEXT NOT NULL,
    prev_entry_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    UNIQUE (exhibit_id, seq)
  );
  CREATE INDEX custody_exhibit ON custody_log(exhibit_id, seq);

  -- Purging is only possible while this flag is set, i.e. when the user
  -- deletes an entire case. Normal operation can never rewrite history.
  CREATE TABLE purge_guard (id INTEGER PRIMARY KEY CHECK (id = 1), enabled INTEGER NOT NULL);
  INSERT INTO purge_guard (id, enabled) VALUES (1, 0);

  CREATE TRIGGER custody_no_update BEFORE UPDATE ON custody_log
  BEGIN
    SELECT RAISE(ABORT, 'custody log is append-only');
  END;

  CREATE TRIGGER custody_no_delete BEFORE DELETE ON custody_log
  WHEN (SELECT enabled FROM purge_guard WHERE id = 1) = 0
  BEGIN
    SELECT RAISE(ABORT, 'custody log is append-only');
  END;

  CREATE TRIGGER pages_immutable BEFORE UPDATE OF original_path, sha256, page_index, exhibit_id ON pages
  BEGIN
    SELECT RAISE(ABORT, 'original pages are immutable');
  END;

  CREATE TRIGGER versions_immutable BEFORE UPDATE ON versions
  BEGIN
    SELECT RAISE(ABORT, 'versions are immutable');
  END;

  CREATE VIRTUAL TABLE search_index USING fts5(
    title,
    body,
    exhibit_id UNINDEXED,
    case_id UNINDEXED,
    page_index UNINDEXED,
    tokenize = 'porter unicode61 remove_diacritics 2'
  );
  `,
  `
  ALTER TABLE exhibits ADD COLUMN source TEXT NOT NULL DEFAULT 'scan';
  ALTER TABLE exhibits ADD COLUMN kind TEXT NOT NULL DEFAULT 'pages';
  ALTER TABLE exhibits ADD COLUMN purged_at TEXT;
  CREATE TABLE prefs (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `,
];
