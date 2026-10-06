import type { SQLiteDatabase } from 'expo-sqlite';

import type { CaseRow, CaseSummary, ExhibitListItem, ExhibitRow, PageRow, SearchHit, VersionRow } from './types';

export function listCases(db: SQLiteDatabase) {
  return db.getAllAsync<CaseSummary>(
    `SELECT c.*,
       (SELECT COUNT(*) FROM exhibits e WHERE e.case_id = c.id AND e.deleted_at IS NULL) AS exhibit_count,
       (SELECT COALESCE(SUM(page_count), 0) FROM exhibits e WHERE e.case_id = c.id AND e.deleted_at IS NULL) AS page_count,
       (SELECT MAX(timestamp) FROM custody_log l WHERE l.case_id = c.id) AS last_activity
     FROM cases c ORDER BY COALESCE(last_activity, c.updated_at) DESC`,
  );
}

export function getCase(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<CaseRow>('SELECT * FROM cases WHERE id = ?', id);
}

export async function countActive(db: SQLiteDatabase) {
  const r = await db.getFirstAsync<{ cases: number; exhibits: number }>(
    `SELECT (SELECT COUNT(*) FROM cases) AS cases,
            (SELECT COUNT(*) FROM exhibits WHERE deleted_at IS NULL) AS exhibits`,
  );
  return r ?? { cases: 0, exhibits: 0 };
}

export function listExhibits(db: SQLiteDatabase, caseId: string) {
  return db.getAllAsync<ExhibitListItem>(
    `SELECT e.*, v.sha256 AS current_sha256, v.version AS current_version,
       (SELECT original_path FROM pages p WHERE p.exhibit_id = e.id ORDER BY page_index LIMIT 1) AS first_page_path
     FROM exhibits e LEFT JOIN versions v ON v.id = e.current_version_id
     WHERE e.case_id = ? AND e.deleted_at IS NULL ORDER BY e.number ASC`,
    caseId,
  );
}

export function listWithdrawnNumbers(db: SQLiteDatabase, caseId: string) {
  return db
    .getAllAsync<{ number: number }>('SELECT number FROM exhibits WHERE case_id = ? AND deleted_at IS NOT NULL', caseId)
    .then((rows) => rows.map((r) => r.number));
}

export function getExhibit(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<ExhibitRow>('SELECT * FROM exhibits WHERE id = ?', id);
}

export function listPages(db: SQLiteDatabase, exhibitId: string) {
  return db.getAllAsync<PageRow>('SELECT * FROM pages WHERE exhibit_id = ? ORDER BY page_index ASC', exhibitId);
}

export function listVersions(db: SQLiteDatabase, exhibitId: string) {
  return db.getAllAsync<VersionRow>('SELECT * FROM versions WHERE exhibit_id = ? ORDER BY version ASC', exhibitId);
}

export function getVersion(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<VersionRow>('SELECT * FROM versions WHERE id = ?', id);
}

export function searchAll(db: SQLiteDatabase, match: string, limit = 50) {
  return db.getAllAsync<SearchHit>(
    `SELECT s.exhibit_id, s.case_id, s.page_index,
       e.title AS exhibit_title, e.number AS exhibit_number, c.title AS case_title,
       snippet(search_index, 1, '[[', ']]', '…', 14) AS snippet
     FROM search_index s
     JOIN exhibits e ON e.id = s.exhibit_id AND e.deleted_at IS NULL
     JOIN cases c ON c.id = s.case_id
     WHERE search_index MATCH ?
     ORDER BY bm25(search_index, 4.0, 1.0)
     LIMIT ?`,
    match,
    limit,
  );
}

export function listTrash(db: SQLiteDatabase) {
  return db.getAllAsync<ExhibitRow & { case_title: string }>(
    `SELECT e.*, c.title AS case_title FROM exhibits e JOIN cases c ON c.id = e.case_id
     WHERE e.deleted_at IS NOT NULL AND e.purged_at IS NULL ORDER BY e.deleted_at DESC`,
  );
}

export function listAllActiveExhibits(db: SQLiteDatabase) {
  return db.getAllAsync<ExhibitRow & { case_title: string }>(
    `SELECT e.*, c.title AS case_title FROM exhibits e JOIN cases c ON c.id = e.case_id
     WHERE e.deleted_at IS NULL ORDER BY c.updated_at DESC, e.number ASC`,
  );
}
