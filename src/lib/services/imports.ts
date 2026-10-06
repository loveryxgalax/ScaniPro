import * as DocumentPicker from 'expo-document-picker';
import { randomUUID } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { PDFDocument } from 'pdf-lib';

import { captureDigest } from '../core/custody';
import { getDb } from '../db';
import { appendCustody } from '../db/custody';
import { notifyDataChanged } from '../events';
import { deleteExternal, deleteTree, exhibitDir, readBytes, readExternal, writeBytes } from '../platform/files';
import { sha256 } from '../platform/hash';
import { convertToJpeg, isJpeg, splitSpread } from '../platform/images';
import { scanPages } from '../platform/scanner';
import { prefsStore } from '../state/prefs';
import { captureExhibit, type SourceFile } from './capture';

/** Turns arbitrary picked images into JPEG pages, keeping the originals as hashed sources. */
async function normalise(files: { uri: string; name: string }[]) {
  const pages: string[] = [];
  const sources: SourceFile[] = [];
  const temps: string[] = [];
  for (const f of files) {
    const bytes = await readExternal(f.uri);
    if (isJpeg(bytes)) {
      pages.push(f.uri);
      sources.push({ uri: f.uri, name: f.name, converted: false });
    } else {
      const jpg = await convertToJpeg(f.uri);
      temps.push(jpg);
      pages.push(jpg);
      sources.push({ uri: f.uri, name: f.name, converted: true });
    }
  }
  return { pages, sources, temps };
}

/** Pick photos and seal them as one exhibit. Returns the exhibit id, or null if cancelled. */
export async function importFromPhotos(caseId: string, onBusy?: (label: string) => void): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1, selectionLimit: 50, exif: false });
  if (r.canceled || !r.assets.length) return null;
  const files = r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName ?? `photo-${i + 1}.jpg` }));
  onBusy?.(`Sealing ${files.length} photo${files.length > 1 ? 's' : ''}…`);
  const { pages, sources, temps } = await normalise(files);
  try {
    return await captureExhibit(caseId, pages, { source: 'photos', sources, cleanup: false });
  } finally {
    temps.forEach(deleteExternal);
    files.forEach((f) => deleteExternal(f.uri));
  }
}

/**
 * Pick files. PDFs each become their own exhibit (kept byte-for-byte); any
 * images picked together become one multi-page exhibit. Returns created ids.
 */
export async function importFromFiles(caseId: string, onBusy?: (label: string) => void): Promise<string[]> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
  if (r.canceled || !r.assets.length) return [];
  onBusy?.(`Sealing ${r.assets.length} file${r.assets.length > 1 ? 's' : ''}…`);
  const ids: string[] = [];
  const images = r.assets.filter((a) => !(a.mimeType === 'application/pdf' || a.name.toLowerCase().endsWith('.pdf')));
  for (const pdf of r.assets.filter((a) => !images.includes(a))) {
    ids.push(await importPdf(caseId, pdf.uri, pdf.name));
    deleteExternal(pdf.uri);
  }
  if (images.length) {
    const { pages, sources, temps } = await normalise(images.map((a) => ({ uri: a.uri, name: a.name })));
    try {
      ids.push(await captureExhibit(caseId, pages, { source: 'files', sources, cleanup: false }));
    } finally {
      temps.forEach(deleteExternal);
      images.forEach((a) => deleteExternal(a.uri));
    }
  }
  return ids;
}

/** Imports a PDF unchanged as Version 1 of a new exhibit. */
export async function importPdf(caseId: string, uri: string, name: string): Promise<string> {
  const bytes = await readExternal(uri);
  let pageCount = 0;
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    pageCount = doc.getPageCount();
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    throw new Error(/encrypt/i.test(msg) ? `"${name}" is password-protected. Remove the password and import it again.` : `"${name}" is not a readable PDF.`);
  }
  const db = await getDb();
  const exhibitId = randomUUID();
  const versionId = randomUUID();
  const now = new Date().toISOString();
  const dir = exhibitDir(caseId, exhibitId);
  const rel = `${dir}/original/imported.pdf`;
  const fileHash = await sha256(bytes);
  try {
    writeBytes(rel, bytes);
    if ((await sha256(await readBytes(rel))) !== fileHash) throw new Error('The PDF failed its write check. Please import it again.');
    const digest = await captureDigest([fileHash], sha256);
    const title = name.replace(/\.pdf$/i, '').slice(0, 120) || 'Imported PDF';
    await db.withExclusiveTransactionAsync(async (tx) => {
      const c = await tx.getFirstAsync<{ next_exhibit_number: number }>('SELECT next_exhibit_number FROM cases WHERE id = ?', caseId);
      if (!c) throw new Error('Case not found.');
      const number = c.next_exhibit_number;
      await tx.runAsync('UPDATE cases SET next_exhibit_number = ?, updated_at = ? WHERE id = ?', number + 1, now, caseId);
      await tx.runAsync(
        `INSERT INTO exhibits (id, case_id, number, title, page_count, captured_at, capture_digest, ocr_status, source, kind, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'skipped', 'files', 'pdf', ?, ?)`,
        exhibitId, caseId, number, title, pageCount, now, digest, now, now,
      );
      await tx.runAsync(
        `INSERT INTO versions (id, exhibit_id, version, kind, parent_version_id, file_path, sha256, bytes, description, created_at)
         VALUES (?, ?, 1, 'original', NULL, ?, ?, ?, ?, ?)`,
        versionId, exhibitId, rel, fileHash, bytes.length, 'Imported PDF, kept byte-for-byte', now,
      );
      await tx.runAsync('UPDATE exhibits SET current_version_id = ? WHERE id = ?', versionId, exhibitId);
      await tx.runAsync('INSERT INTO search_index (title, body, exhibit_id, case_id, page_index) VALUES (?, ?, ?, ?, 0)', title, '', exhibitId, caseId);
      await appendCustody(tx, {
        exhibitId,
        caseId,
        action: 'imported',
        fileSha256: fileHash,
        timestamp: now,
        details: { exhibitNumber: number, title, source: 'Files', fileName: name, bytes: bytes.length, pageCount, keptUnchanged: true },
      });
    });
  } catch (e) {
    deleteTree(dir);
    throw e;
  }
  notifyDataChanged();
  return exhibitId;
}

/** Book mode: each captured spread is split into left and right pages. */
export async function scanBook(caseId: string, onBusy?: (label: string) => void): Promise<string | null> {
  const spreads = await scanPages(prefsStore.get().scanQuality);
  if (!spreads) return null;
  onBusy?.(`Splitting and sealing ${spreads.length * 2} pages…`);
  const pages: string[] = [];
  const sources: SourceFile[] = [];
  try {
    for (let i = 0; i < spreads.length; i++) {
      const uri = spreads[i] as string;
      const [left, right] = await splitSpread(uri, await readExternal(uri));
      pages.push(left, right);
      sources.push({ uri, name: `spread-${i + 1}.jpg`, converted: false });
    }
    return await captureExhibit(caseId, pages, { source: 'book', sources, cleanup: true });
  } finally {
    spreads.forEach(deleteExternal);
  }
}

/** Standard scan with the user's quality preference. */
export async function scanDocument(caseId: string, onBusy?: (label: string) => void): Promise<string | null> {
  const uris = await scanPages(prefsStore.get().scanQuality);
  if (!uris) return null;
  onBusy?.(`Sealing ${uris.length} page${uris.length > 1 ? 's' : ''}…`);
  return captureExhibit(caseId, uris);
}
