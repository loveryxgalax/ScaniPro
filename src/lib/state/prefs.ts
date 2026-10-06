import { getDb } from '../db';
import { createStore } from './store';

export type Prefs = {
  casesView: 'list' | 'grid';
  casesSort: 'modified' | 'created' | 'name';
  scanQuality: 'high' | 'standard';
};

const DEFAULTS: Prefs = { casesView: 'list', casesSort: 'modified', scanQuality: 'high' };

export const prefsStore = createStore<Prefs>(DEFAULTS);

export async function loadPrefs() {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM prefs');
  const next: Partial<Prefs> = {};
  for (const r of rows) {
    if (r.key in DEFAULTS) (next as Record<string, string>)[r.key] = r.value;
  }
  prefsStore.set(next);
}

export async function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  prefsStore.set({ [key]: value } as Partial<Prefs>);
  const db = await getDb();
  await db.runAsync('INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}
