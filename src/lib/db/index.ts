import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS } from './schema';

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version] as string;
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(sql);
      await tx.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version++;
  }
}

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      // expo-sqlite finalizes every open statement before closing a connection,
      // including FTS5's internal ones, which FTS5 then finalizes again on
      // sqlite3_close (use-after-free crash when a withExclusiveTransactionAsync
      // connection closes). We never keep prepared statements, so skip it.
      // Transactions inherit these options.
      const db = await openDatabaseAsync('caseseal.db', { finalizeUnusedStatementsBeforeClosing: false });
      await migrate(db);
      return db;
    })().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}
