import { randomUUID } from 'expo-crypto';
import * as Sharing from 'expo-sharing';

import { applyAnnotations } from '../core/annotatePdf';
import { captureDigest } from '../core/custody';
import { padExhibitNumber, safeFileName } from '../core/text';
import type { Annotation } from '../core/types';
import { getDb } from '../db';
import { appendCustody, listCustody, verifyCustody } from '../db/custody';
import { getExhibit, getVersion, listPages, listVersions } from '../db/queries';
import type { ExhibitRow, VersionRow } from '../db/types';
import { notifyDataChanged } from '../events';
import { deviceContext } from '../platform/device';
import { deleteTree, exhibitDir, exportFile, readBytes, toAbsolute, writeBytes } from '../platform/files';
import { sha256 } from '../platform/hash';

async function requireExhibit(id: string): Promise<ExhibitRow> {
  const db = await getDb();
  const ex = await getExhibit(db, id);
  if (!ex || ex.deleted_at) throw new Error('Exhibit not found.');
  return ex;
}

async function currentHash(ex: ExhibitRow): Promise<string> {
  if (!ex.current_version_id) return ex.capture_digest;
  const v = await getVersion(await getDb(), ex.current_version_id);
  return v?.sha256 ?? ex.capture_digest;
}

export function versionLabel(v: Pick<VersionRow, 'version' | 'kind'>) {
  return v.kind === 'original' ? 'Original' : `Version ${v.version} (derived)`;
}

export function exhibitFileName(ex: Pick<ExhibitRow, 'number' | 'title'>, v: Pick<VersionRow, 'version'>) {
  return `Exhibit-${padExhibitNumber(ex.number)}_${safeFileName(ex.title, 'Exhibit')}_v${v.version}.pdf`;
}

export async function renameExhibit(id: string, title: string) {
  const next = title.trim();
  if (!next) throw new Error('Title cannot be empty.');
  if (next.length > 120) throw new Error('Title must be 120 characters or fewer.');
  const ex = await requireExhibit(id);
  if (ex.title === next) return;
  const db = await getDb();
  const fileSha256 = await currentHash(ex);
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE exhibits SET title = ?, updated_at = ? WHERE id = ?', next, new Date().toISOString(), id);
    await tx.runAsync('UPDATE search_index SET title = ? WHERE exhibit_id = ?', next, id);
    await appendCustody(tx, {
      exhibitId: id,
      caseId: ex.case_id,
      action: 'renamed',
      fileSha256,
      details: { from: ex.title, to: next, fileContentsChanged: false },
    });
  });
  notifyDataChanged();
}

export const TRASH_DAYS = 30;

/**
 * Moves an exhibit to Recently Deleted. Files are kept for 30 days so it can
 * be restored; the exhibit number is never reused either way.
 */
export async function withdrawExhibit(id: string, reason: string) {
  const ex = await requireExhibit(id);
  const db = await getDb();
  const fileSha256 = await currentHash(ex);
  const now = new Date();
  const until = new Date(now.getTime() + TRASH_DAYS * 86400000).toISOString();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await appendCustody(tx, {
      exhibitId: id,
      caseId: ex.case_id,
      action: 'deleted',
      fileSha256,
      details: { reason: reason.trim() || 'Withdrawn by user', recoverableUntil: until },
    });
    await tx.runAsync('UPDATE exhibits SET deleted_at = ?, updated_at = ? WHERE id = ?', now.toISOString(), now.toISOString(), id);
    await tx.runAsync('DELETE FROM search_index WHERE exhibit_id = ?', id);
  });
  notifyDataChanged();
}

export async function restoreExhibit(id: string) {
  const db = await getDb();
  const ex = await getExhibit(db, id);
  if (!ex || !ex.deleted_at || ex.purged_at) throw new Error('This exhibit can no longer be restored.');
  const pages = await listPages(db, id);
  const fileSha256 = await currentHash(ex);
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE exhibits SET deleted_at = NULL, updated_at = ? WHERE id = ?', new Date().toISOString(), id);
    if (pages.length) {
      for (const p of pages) {
        await tx.runAsync('INSERT INTO search_index (title, body, exhibit_id, case_id, page_index) VALUES (?, ?, ?, ?, ?)', ex.title, p.ocr_text ?? '', id, ex.case_id, p.page_index);
      }
    } else {
      await tx.runAsync('INSERT INTO search_index (title, body, exhibit_id, case_id, page_index) VALUES (?, ?, ?, ?, 0)', ex.title, '', id, ex.case_id);
    }
    await appendCustody(tx, { exhibitId: id, caseId: ex.case_id, action: 'restored', fileSha256, details: { from: 'Recently Deleted' } });
  });
  notifyDataChanged();
}

/** Deletes the files for good. The custody history (with hashes) is kept and closed. */
export async function purgeExhibit(id: string) {
  const db = await getDb();
  const ex = await getExhibit(db, id);
  if (!ex || !ex.deleted_at || ex.purged_at) return;
  const fileSha256 = await currentHash(ex);
  await db.withExclusiveTransactionAsync(async (tx) => {
    await appendCustody(tx, { exhibitId: id, caseId: ex.case_id, action: 'purged', fileSha256, details: { filesRemoved: true } });
    await tx.runAsync('UPDATE exhibits SET purged_at = ? WHERE id = ?', new Date().toISOString(), id);
  });
  deleteTree(exhibitDir(ex.case_id, id));
  notifyDataChanged();
}

export async function purgeExpired() {
  const db = await getDb();
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86400000).toISOString();
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM exhibits WHERE deleted_at IS NOT NULL AND purged_at IS NULL AND deleted_at < ?', cutoff);
  for (const r of rows) await purgeExhibit(r.id);
}

export type VerificationReport = {
  ok: boolean;
  checkedAt: string;
  pages: { index: number; expected: string; actual: string | null; ok: boolean }[];
  captureDigestOk: boolean;
  versions: { version: number; expected: string; actual: string | null; ok: boolean }[];
  sources: { name: string; expected: string; actual: string | null; ok: boolean }[];
  custody: Awaited<ReturnType<typeof verifyCustody>>;
};

async function hashIfPresent(rel: string): Promise<string | null> {
  const f = toAbsolute(rel);
  if (!f.exists) return null;
  return sha256(await f.bytes());
}

/** Re-hashes every stored file and re-walks the custody chain. */
export async function verifyExhibit(id: string): Promise<VerificationReport> {
  const ex = await requireExhibit(id);
  const db = await getDb();
  const pages = await listPages(db, id);
  const versions = await listVersions(db, id);
  const pageResults: VerificationReport['pages'] = [];
  for (const p of pages) {
    const actual = await hashIfPresent(p.original_path);
    pageResults.push({ index: p.page_index, expected: p.sha256, actual, ok: actual === p.sha256 });
  }
  const versionResults: VerificationReport['versions'] = [];
  for (const v of versions) {
    const actual = await hashIfPresent(v.file_path);
    versionResults.push({ version: v.version, expected: v.sha256, actual, ok: actual === v.sha256 });
  }
  const digest = await captureDigest(
    ex.kind === 'pdf' ? [versionResults.find((v) => v.version === 1)?.actual ?? 'missing'] : pageResults.map((p) => p.actual ?? 'missing'),
    sha256,
  );
  // Original source files (imports, book spreads) recorded in the first custody entry.
  const first = (await listCustody(db, id))[0];
  const recorded = (first ? (JSON.parse(first.details) as { sourceFiles?: { name: string; sha256: string; storedAs: string }[] }).sourceFiles : undefined) ?? [];
  const sourceResults: VerificationReport['sources'] = [];
  for (const f of recorded) {
    const actual = await hashIfPresent(f.storedAs);
    sourceResults.push({ name: f.name, expected: f.sha256, actual, ok: actual === f.sha256 });
  }
  const custody = await verifyCustody(db, id);
  const captureDigestOk = digest === ex.capture_digest;
  const ok =
    captureDigestOk && pageResults.every((p) => p.ok) && versionResults.every((v) => v.ok) && sourceResults.every((f) => f.ok) && custody.ok;
  const report: VerificationReport = {
    ok,
    checkedAt: new Date().toISOString(),
    pages: pageResults,
    captureDigestOk,
    versions: versionResults,
    sources: sourceResults,
    custody,
  };
  await db.withExclusiveTransactionAsync(async (tx) => {
    await appendCustody(tx, {
      exhibitId: id,
      caseId: ex.case_id,
      action: ok ? 'verified' : 'verification_failed',
      fileSha256: await currentHash(ex),
      details: {
        pagesChecked: pageResults.length,
        pagesFailed: pageResults.filter((p) => !p.ok).map((p) => p.index + 1),
        versionsChecked: versionResults.length,
        versionsFailed: versionResults.filter((v) => !v.ok).map((v) => v.version),
        sourcesChecked: sourceResults.length,
        sourcesFailed: sourceResults.filter((f) => !f.ok).map((f) => f.name),
        captureDigestOk,
        custodyChainOk: custody.ok,
      },
    });
  });
  notifyDataChanged();
  return report;
}

/**
 * Creates a derived version with annotations/signatures. The base file is
 * re-verified first and never modified; the new file gets its own hash and
 * is linked to its parent and to the original capture digest.
 */
export async function createDerivedVersion(id: string, baseVersionId: string, annotations: Annotation[]) {
  if (!annotations.length) throw new Error('Add at least one annotation or signature first.');
  const ex = await requireExhibit(id);
  const db = await getDb();
  const base = await getVersion(db, baseVersionId);
  if (!base || base.exhibit_id !== id) throw new Error('Base version not found.');
  const baseBytes = await readBytes(base.file_path);
  if ((await sha256(baseBytes)) !== base.sha256) {
    throw new Error('The base file no longer matches its recorded hash. Run Verify Integrity for details.');
  }
  const versions = await listVersions(db, id);
  const nextVersion = Math.max(...versions.map((v) => v.version)) + 1;
  const createdAt = new Date();
  const signatures = annotations.filter((a) => a.kind === 'signature').length;
  const pdf = await applyAnnotations(baseBytes, annotations, {
    label: `Derived version ${nextVersion} of Exhibit ${ex.number}`,
    baseSha256: base.sha256,
    createdAt,
    appVersion: deviceContext().appVersion,
  });
  const hash = await sha256(pdf);
  const rel = `${exhibitDir(ex.case_id, id)}/v${nextVersion}-derived.pdf`;
  writeBytes(rel, pdf);
  const versionId = randomUUID();
  const description = signatures
    ? `Signed (${signatures} signature${signatures > 1 ? 's' : ''}) from version ${base.version}`
    : `Annotated from version ${base.version}`;
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO versions (id, exhibit_id, version, kind, parent_version_id, file_path, sha256, bytes, description, annotations, created_at)
       VALUES (?, ?, ?, 'derived', ?, ?, ?, ?, ?, ?, ?)`,
      versionId,
      id,
      nextVersion,
      base.id,
      rel,
      hash,
      pdf.length,
      description,
      JSON.stringify(annotations),
      createdAt.toISOString(),
    );
    await tx.runAsync('UPDATE exhibits SET current_version_id = ?, updated_at = ? WHERE id = ?', versionId, createdAt.toISOString(), id);
    await appendCustody(tx, {
      exhibitId: id,
      caseId: ex.case_id,
      action: signatures ? 'signed' : 'annotated',
      fileSha256: hash,
      timestamp: createdAt.toISOString(),
      details: {
        version: nextVersion,
        parentVersion: base.version,
        parentSha256: base.sha256,
        captureDigest: ex.capture_digest,
        annotations: annotations.length,
        signatures,
        pages: [...new Set(annotations.map((a) => a.pageIndex + 1))],
      },
    });
  });
  notifyDataChanged();
  return versionId;
}

/** Shares a single exhibit PDF and records that it left the app. */
export async function shareExhibitVersion(id: string, versionId: string) {
  const ex = await requireExhibit(id);
  const db = await getDb();
  const v = await getVersion(db, versionId);
  if (!v) throw new Error('Version not found.');
  const bytes = await readBytes(v.file_path);
  const hash = await sha256(bytes);
  if (hash !== v.sha256) throw new Error('This file no longer matches its recorded hash and was not shared.');
  const name = exhibitFileName(ex, v);
  const out = exportFile(name);
  out.write(bytes);
  await db.withExclusiveTransactionAsync(async (tx) => {
    await appendCustody(tx, {
      exhibitId: id,
      caseId: ex.case_id,
      action: 'shared',
      fileSha256: hash,
      details: { version: v.version, fileName: name, via: 'iOS share sheet' },
    });
  });
  notifyDataChanged();
  await Sharing.shareAsync(out.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name });
}
