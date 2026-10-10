import { canonicalJson } from './canonical';
import { utf8 } from './text';
import type { CustodyAction, DeviceContext, Sha256Fn } from './types';

export const GENESIS_HASH = '0'.repeat(64);

export type CustodyFields = DeviceContext & {
  exhibitId: string;
  seq: number;
  timestamp: string;
  action: CustodyAction;
  details: Record<string, unknown>;
  fileSha256: string;
  prevEntryHash: string;
};

export type CustodyEntry = CustodyFields & { entryHash: string };

/**
 * Each entry commits to the previous entry's hash, so any edit, deletion or
 * reordering of the log breaks the chain and is detected by `verifyChain`.
 */
export async function hashCustodyEntry(fields: CustodyFields, sha256: Sha256Fn): Promise<string> {
  const payload = canonicalJson({
    v: 1,
    exhibitId: fields.exhibitId,
    seq: fields.seq,
    timestamp: fields.timestamp,
    action: fields.action,
    details: fields.details,
    deviceModel: fields.deviceModel,
    osName: fields.osName,
    osVersion: fields.osVersion,
    appVersion: fields.appVersion,
    appBuild: fields.appBuild,
    fileSha256: fields.fileSha256,
    prevEntryHash: fields.prevEntryHash,
  });
  return sha256(utf8(payload));
}

export type ChainVerification =
  | { ok: true; entries: number }
  | { ok: false; entries: number; brokenAtSeq: number; reason: string };

export async function verifyChain(entries: CustodyEntry[], sha256: Sha256Fn): Promise<ChainVerification> {
  let prev = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] as CustodyEntry;
    if (entry.seq !== i + 1) {
      return { ok: false, entries: entries.length, brokenAtSeq: entry.seq, reason: 'Sequence gap' };
    }
    if (entry.prevEntryHash !== prev) {
      return { ok: false, entries: entries.length, brokenAtSeq: entry.seq, reason: 'Previous-entry link mismatch' };
    }
    const expected = await hashCustodyEntry(entry, sha256);
    if (expected !== entry.entryHash) {
      return { ok: false, entries: entries.length, brokenAtSeq: entry.seq, reason: 'Entry contents were altered' };
    }
    prev = entry.entryHash;
  }
  return { ok: true, entries: entries.length };
}

/**
 * The capture digest identifies an exhibit's original pages as a set: the
 * SHA-256 over the ordered list of per-page SHA-256 values.
 */
export async function captureDigest(pageHashes: string[], sha256: Sha256Fn): Promise<string> {
  return sha256(utf8(`caseseal-capture-v1\n${pageHashes.join('\n')}`));
}

export const ACTION_LABELS: Record<CustodyAction, string> = {
  captured: 'Captured',
  ocr_completed: 'Text recognised (OCR)',
  ocr_failed: 'OCR failed',
  pdf_generated: 'Searchable PDF generated',
  renamed: 'Renamed',
  annotated: 'Annotated (derived version)',
  signed: 'Signed (derived version)',
  exported: 'Exported in evidence packet',
  shared: 'Shared',
  verified: 'Integrity verified',
  verification_failed: 'Integrity check FAILED',
  deleted: 'Moved to Recently Deleted',
  imported: 'Imported',
  restored: 'Restored',
  purged: 'Permanently deleted',
};
