import { randomUUID } from 'expo-crypto';

import { captureDigest } from '../core/custody';
import { jpegSize } from '../core/jpeg';
import { buildSearchablePdf } from '../core/searchablePdf';
import { padExhibitNumber } from '../core/text';
import type { OcrLine } from '../core/types';
import { getDb } from '../db';
import { appendCustody } from '../db/custody';
import { getExhibit, listPages } from '../db/queries';
import type { ExhibitRow, ExhibitSource } from '../db/types';
import { notifyDataChanged } from '../events';
import { deviceContext } from '../platform/device';
import {
  deleteExternal,
  deleteTree,
  exhibitDir,
  readBytes,
  readExternal,
  toAbsolute,
  writeBytes,
} from '../platform/files';
import { sha256 } from '../platform/hash';
import { isJpeg } from '../platform/images';
import { recognizePage } from '../platform/ocr';
import { Platform } from 'react-native';

type CapturedPage = { id: string; index: number; rel: string; sha256: string; width: number; height: number; bytes: number };

/**
 * Stores scanned pages as an immutable exhibit. Hashes are computed from the
 * exact bytes written to disk, re-read to confirm, and sealed into the first
 * custody entry before anything else happens.
 */
type Provenance = { name: string; sha256: string; bytes: number; converted: boolean; rel: string };

export type SourceFile = { uri: string; name: string; converted: boolean };

export type CaptureOptions = {
  title?: string;
  source?: ExhibitSource;
  /** Original files the pages were derived from (imports, book spreads); hashed and kept. */
  sources?: SourceFile[];
  /** Delete the page URIs after sealing (true for scanner temp files). */
  cleanup?: boolean;
};

export async function captureExhibit(caseId: string, scannedUris: string[], options: CaptureOptions = {}): Promise<string> {
  const { title, source = 'scan', sources = [], cleanup = true } = options;
  if (!scannedUris.length) throw new Error('No pages were scanned.');
  const db = await getDb();
  const exhibitId = randomUUID();
  const capturedAt = new Date().toISOString();
  const dir = exhibitDir(caseId, exhibitId);
  const pages: CapturedPage[] = [];
  const provenance: Provenance[] = [];

  try {
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i] as SourceFile;
      const bytes = await readExternal(src.uri);
      const ext = (src.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
      const rel = `${dir}/source/source-${padExhibitNumber(i + 1)}.${ext}`;
      writeBytes(rel, bytes);
      provenance.push({ name: src.name, sha256: await sha256(bytes), bytes: bytes.length, converted: src.converted, rel });
    }
    for (let i = 0; i < scannedUris.length; i++) {
      const bytes = await readExternal(scannedUris[i] as string);
      if (!isJpeg(bytes)) throw new Error(`Page ${i + 1} is not a JPEG image.`);
      const { width, height } = jpegSize(bytes);
      const hash = await sha256(bytes);
      const rel = `${dir}/original/page-${padExhibitNumber(i + 1)}.jpg`;
      writeBytes(rel, bytes);
      const check = await sha256(await readBytes(rel));
      if (check !== hash) throw new Error(`Page ${i + 1} failed its write check. Please scan again.`);
      pages.push({ id: randomUUID(), index: i, rel, sha256: hash, width, height, bytes: bytes.length });
    }
    const digest = await captureDigest(
      pages.map((p) => p.sha256),
      sha256,
    );

    await db.withExclusiveTransactionAsync(async (tx) => {
      const c = await tx.getFirstAsync<{ next_exhibit_number: number }>(
        'SELECT next_exhibit_number FROM cases WHERE id = ?',
        caseId,
      );
      if (!c) throw new Error('Case not found.');
      const number = c.next_exhibit_number;
      const finalTitle = title?.trim() || `Exhibit ${number}`;
      await tx.runAsync('UPDATE cases SET next_exhibit_number = ?, updated_at = ? WHERE id = ?', number + 1, capturedAt, caseId);
      await tx.runAsync(
        `INSERT INTO exhibits (id, case_id, number, title, page_count, captured_at, capture_digest, ocr_status, source, kind, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'pages', ?, ?)`,
        exhibitId,
        caseId,
        number,
        finalTitle,
        pages.length,
        capturedAt,
        digest,
        source,
        capturedAt,
        capturedAt,
      );
      for (const p of pages) {
        await tx.runAsync(
          `INSERT INTO pages (id, exhibit_id, page_index, original_path, sha256, width, height, bytes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          p.id,
          exhibitId,
          p.index,
          p.rel,
          p.sha256,
          p.width,
          p.height,
          p.bytes,
        );
        await tx.runAsync(
          'INSERT INTO search_index (title, body, exhibit_id, case_id, page_index) VALUES (?, ?, ?, ?, ?)',
          finalTitle,
          '',
          exhibitId,
          caseId,
          p.index,
        );
      }
      const camera = Platform.OS === 'ios' ? 'VisionKit document camera' : 'ML Kit document scanner';
      await appendCustody(tx, {
        exhibitId,
        caseId,
        action: source === 'photos' || source === 'files' ? 'imported' : 'captured',
        fileSha256: digest,
        timestamp: capturedAt,
        details: {
          exhibitNumber: number,
          title: finalTitle,
          pageCount: pages.length,
          pageSha256: pages.map((p) => p.sha256),
          source: { scan: camera, book: `${camera} (book mode: spreads split into pages)`, photos: 'Photo library', files: 'Files' }[source],
          ...(provenance.length
            ? { sourceFiles: provenance.map((f) => ({ name: f.name, sha256: f.sha256, bytes: f.bytes, convertedToJpeg: f.converted, storedAs: f.rel })) }
            : {}),
        },
      });
    });
  } catch (e) {
    deleteTree(dir);
    throw e;
  } finally {
    if (cleanup) scannedUris.forEach(deleteExternal);
  }

  notifyDataChanged();
  enqueueProcessing(exhibitId);
  return exhibitId;
}

let queue: Promise<void> = Promise.resolve();
const queued = new Set<string>();

export function enqueueProcessing(exhibitId: string) {
  if (queued.has(exhibitId)) return;
  queued.add(exhibitId);
  queue = queue
    .then(() => processExhibit(exhibitId))
    .catch((e) => console.warn('processing failed', e))
    .finally(() => queued.delete(exhibitId));
}

/** Picks up exhibits whose OCR or PDF generation was interrupted. */
export async function resumePendingProcessing() {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM exhibits WHERE deleted_at IS NULL AND kind = 'pages' AND (ocr_status IN ('pending', 'running') OR current_version_id IS NULL)",
  );
  rows.forEach((r) => enqueueProcessing(r.id));
}

async function setStatus(id: string, status: ExhibitRow['ocr_status']) {
  const db = await getDb();
  await db.runAsync('UPDATE exhibits SET ocr_status = ?, updated_at = ? WHERE id = ?', status, new Date().toISOString(), id);
  notifyDataChanged();
}

/** Runs on-device OCR, then builds the searchable PDF (version 1). */
export async function processExhibit(exhibitId: string) {
  const db = await getDb();
  const exhibit = await getExhibit(db, exhibitId);
  if (!exhibit || exhibit.deleted_at || exhibit.kind !== 'pages') return;
  const pages = await listPages(db, exhibitId);

  if (exhibit.ocr_status !== 'done' && exhibit.ocr_status !== 'failed') {
    await setStatus(exhibitId, 'running');
    let engine = '';
    let characters = 0;
    const failures: number[] = [];
    for (const page of pages) {
      try {
        const r = await recognizePage(toAbsolute(page.original_path).uri, page.width, page.height);
        engine = r.engine;
        characters += r.text.length;
        await db.runAsync('UPDATE pages SET ocr_text = ?, ocr_lines = ? WHERE id = ?', r.text, JSON.stringify(r.lines), page.id);
        await db.runAsync(
          'UPDATE search_index SET body = ? WHERE exhibit_id = ? AND page_index = ?',
          r.text,
          exhibitId,
          page.page_index,
        );
      } catch (e) {
        failures.push(page.page_index + 1);
        console.warn('OCR failed', e);
      }
    }
    const ok = failures.length < pages.length;
    await db.withExclusiveTransactionAsync(async (tx) => {
      await appendCustody(tx, {
        exhibitId,
        caseId: exhibit.case_id,
        action: ok ? 'ocr_completed' : 'ocr_failed',
        fileSha256: exhibit.capture_digest,
        details: { engine: engine || 'on-device', characters, failedPages: failures, originalsModified: false },
      });
    });
    await setStatus(exhibitId, ok ? 'done' : 'failed');
  }

  const fresh = await getExhibit(db, exhibitId);
  if (!fresh || fresh.current_version_id) return;
  const latestPages = await listPages(db, exhibitId);
  const inputs = [];
  for (const p of latestPages) {
    const jpeg = await readBytes(p.original_path);
    if ((await sha256(jpeg)) !== p.sha256) throw new Error(`Original page ${p.page_index + 1} no longer matches its hash.`);
    inputs.push({ jpeg, lines: p.ocr_lines ? (JSON.parse(p.ocr_lines) as OcrLine[]) : [] });
  }
  const pdf = await buildSearchablePdf(inputs, {
    title: `Exhibit ${fresh.number}: ${fresh.title}`,
    subject: 'Captured with CaseSeal',
    keywords: [`capture-digest:${fresh.capture_digest}`],
    createdAt: new Date(fresh.captured_at),
    appVersion: deviceContext().appVersion,
  });
  const hash = await sha256(pdf);
  const rel = `${exhibitDir(fresh.case_id, exhibitId)}/v1-searchable.pdf`;
  if (toAbsolute(rel).exists) toAbsolute(rel).delete(); // left over from an interrupted run, never referenced
  writeBytes(rel, pdf);
  const versionId = randomUUID();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO versions (id, exhibit_id, version, kind, parent_version_id, file_path, sha256, bytes, description, created_at)
       VALUES (?, ?, 1, 'original', NULL, ?, ?, ?, ?, ?)`,
      versionId,
      exhibitId,
      rel,
      hash,
      pdf.length,
      'Searchable PDF of the original capture',
      new Date().toISOString(),
    );
    await tx.runAsync('UPDATE exhibits SET current_version_id = ?, updated_at = ? WHERE id = ?', versionId, new Date().toISOString(), exhibitId);
    await appendCustody(tx, {
      exhibitId,
      caseId: fresh.case_id,
      action: 'pdf_generated',
      fileSha256: hash,
      details: { version: 1, bytes: pdf.length, captureDigest: fresh.capture_digest, textLayer: fresh.ocr_status === 'done' },
    });
  });
  notifyDataChanged();
}
