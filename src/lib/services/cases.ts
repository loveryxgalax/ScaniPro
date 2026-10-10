import { randomUUID } from 'expo-crypto';

import { getDb } from '../db';
import { notifyDataChanged } from '../events';
import { deleteTree } from '../platform/files';

export type CaseInput = { title: string; reference?: string | null; matterDate?: string | null; notes?: string | null };

const clean = (s?: string | null) => (s && s.trim() ? s.trim() : null);

export function validateCase(input: CaseInput): string | null {
  if (!input.title.trim()) return 'Give the case a title.';
  if (input.title.trim().length > 120) return 'Title must be 120 characters or fewer.';
  if (input.matterDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.matterDate.trim())) return 'Use the date format YYYY-MM-DD.';
  if (input.matterDate && Number.isNaN(Date.parse(input.matterDate.trim()))) return 'That date is not valid.';
  return null;
}

export async function createCase(input: CaseInput): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO cases (id, title, reference, matter_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id,
    input.title.trim(),
    clean(input.reference),
    clean(input.matterDate),
    clean(input.notes),
    now,
    now,
  );
  notifyDataChanged();
  return id;
}

export async function updateCase(id: string, input: CaseInput) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE cases SET title = ?, reference = ?, matter_date = ?, notes = ?, updated_at = ? WHERE id = ?',
    input.title.trim(),
    clean(input.reference),
    clean(input.matterDate),
    clean(input.notes),
    new Date().toISOString(),
    id,
  );
  notifyDataChanged();
}

/** Permanently removes a case, its files and its custody history. */
export async function deleteCase(id: string) {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE purge_guard SET enabled = 1 WHERE id = 1');
    await tx.runAsync('DELETE FROM custody_log WHERE case_id = ?', id);
    await tx.runAsync('DELETE FROM search_index WHERE case_id = ?', id);
    await tx.runAsync('DELETE FROM cases WHERE id = ?', id);
    await tx.runAsync('UPDATE purge_guard SET enabled = 0 WHERE id = 1');
  });
  deleteTree(`cases/${id}`);
  notifyDataChanged();
}

export async function deleteAllData() {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE purge_guard SET enabled = 1 WHERE id = 1');
    await tx.runAsync('DELETE FROM custody_log');
    await tx.runAsync('DELETE FROM search_index');
    await tx.runAsync('DELETE FROM cases');
    await tx.runAsync('UPDATE purge_guard SET enabled = 0 WHERE id = 1');
  });
  deleteTree('cases');
  notifyDataChanged();
}
