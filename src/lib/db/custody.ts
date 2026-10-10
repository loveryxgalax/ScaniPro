import type { SQLiteDatabase } from 'expo-sqlite';

import { GENESIS_HASH, hashCustodyEntry, verifyChain, type CustodyEntry } from '../core/custody';
import type { CustodyAction } from '../core/types';
import { deviceContext } from '../platform/device';
import { sha256 } from '../platform/hash';
import type { CustodyRow } from './types';

/**
 * Appends one entry to an exhibit's custody chain. Must run inside an
 * exclusive transaction so `seq` and `prev_entry_hash` cannot race.
 */
export async function appendCustody(
  tx: SQLiteDatabase,
  args: {
    exhibitId: string;
    caseId: string;
    action: CustodyAction;
    fileSha256: string;
    details?: Record<string, unknown>;
    timestamp?: string;
  },
): Promise<CustodyEntry> {
  const last = await tx.getFirstAsync<{ seq: number; entry_hash: string }>(
    'SELECT seq, entry_hash FROM custody_log WHERE exhibit_id = ? ORDER BY seq DESC LIMIT 1',
    args.exhibitId,
  );
  const fields = {
    ...deviceContext(),
    exhibitId: args.exhibitId,
    seq: (last?.seq ?? 0) + 1,
    timestamp: args.timestamp ?? new Date().toISOString(),
    action: args.action,
    details: args.details ?? {},
    fileSha256: args.fileSha256,
    prevEntryHash: last?.entry_hash ?? GENESIS_HASH,
  };
  const entryHash = await hashCustodyEntry(fields, sha256);
  await tx.runAsync(
    `INSERT INTO custody_log (exhibit_id, case_id, seq, timestamp, action, details, device_model, os_name,
      os_version, app_version, app_build, file_sha256, prev_entry_hash, entry_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    fields.exhibitId,
    args.caseId,
    fields.seq,
    fields.timestamp,
    fields.action,
    JSON.stringify(fields.details),
    fields.deviceModel,
    fields.osName,
    fields.osVersion,
    fields.appVersion,
    fields.appBuild,
    fields.fileSha256,
    fields.prevEntryHash,
    entryHash,
  );
  return { ...fields, entryHash };
}

export function rowToEntry(r: CustodyRow): CustodyEntry {
  return {
    exhibitId: r.exhibit_id,
    seq: r.seq,
    timestamp: r.timestamp,
    action: r.action,
    details: JSON.parse(r.details) as Record<string, unknown>,
    deviceModel: r.device_model,
    osName: r.os_name,
    osVersion: r.os_version,
    appVersion: r.app_version,
    appBuild: r.app_build,
    fileSha256: r.file_sha256,
    prevEntryHash: r.prev_entry_hash,
    entryHash: r.entry_hash,
  };
}

export async function listCustody(db: SQLiteDatabase, exhibitId: string): Promise<CustodyRow[]> {
  return db.getAllAsync<CustodyRow>('SELECT * FROM custody_log WHERE exhibit_id = ? ORDER BY seq ASC', exhibitId);
}

export async function verifyCustody(db: SQLiteDatabase, exhibitId: string) {
  const rows = await listCustody(db, exhibitId);
  return verifyChain(rows.map(rowToEntry), sha256);
}
