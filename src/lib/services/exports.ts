import { buildDocx } from '../core/docx';
import { buildExpensePdf, expenseCsv, type ExpenseLine } from '../core/expense';
import { mergePdfs } from '../core/merge';
import { buildPptx } from '../core/pptx';
import { padExhibitNumber, safeFileName, utf8 } from '../core/text';
import { createZip } from '../core/zip';
import { getDb } from '../db';
import { appendCustody } from '../db/custody';
import { getCase, getExhibit, getVersion, listPages } from '../db/queries';
import type { ExhibitRow, PageRow, VersionRow } from '../db/types';
import { notifyDataChanged } from '../events';
import { deviceContext } from '../platform/device';
import { readBytes } from '../platform/files';
import { sha256 } from '../platform/hash';
import { versionLabel } from './exhibits';
import { saveExport, shareExport, type ExportedFile } from './share';

export type ExportFormat = 'text' | 'images' | 'docx' | 'pptx';

type Loaded = { ex: ExhibitRow; version: VersionRow; pages: PageRow[]; caseTitle: string };

async function load(exhibitId: string): Promise<Loaded> {
  const db = await getDb();
  const ex = await getExhibit(db, exhibitId);
  if (!ex || ex.deleted_at) throw new Error('Exhibit not found.');
  if (!ex.current_version_id) throw new Error('This exhibit is still being processed. Try again in a moment.');
  const version = await getVersion(db, ex.current_version_id);
  if (!version) throw new Error('Exhibit file not found.');
  const bytes = await readBytes(version.file_path);
  if ((await sha256(bytes)) !== version.sha256) throw new Error('This exhibit no longer matches its recorded hash and was not exported.');
  const kase = await getCase(db, ex.case_id);
  return { ex, version, pages: await listPages(db, exhibitId), caseTitle: kase?.title ?? '' };
}

/** Reads every original page and confirms it still matches its capture hash. */
async function verifiedPages(pages: PageRow[]) {
  const out: { page: PageRow; jpeg: Uint8Array }[] = [];
  for (const page of pages) {
    const jpeg = await readBytes(page.original_path);
    if ((await sha256(jpeg)) !== page.sha256) throw new Error(`Page ${page.page_index + 1} no longer matches its capture hash.`);
    out.push({ page, jpeg });
  }
  return out;
}

async function logShare(l: Loaded, format: string, file: ExportedFile) {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await appendCustody(tx, {
      exhibitId: l.ex.id,
      caseId: l.ex.case_id,
      action: 'shared',
      fileSha256: l.version.sha256,
      details: { format, fileName: file.name, exportedSha256: file.sha256, bytes: file.bytes, fromVersion: l.version.version },
    });
  });
  notifyDataChanged();
}

function provenance(l: Loaded): string[] {
  return [
    `Case: ${l.caseTitle}`,
    `Exhibit ${l.ex.number}, ${versionLabel(l.version)}, captured ${l.ex.captured_at}`,
    `Capture digest ${l.ex.capture_digest}`,
    `Exhibit PDF SHA-256 ${l.version.sha256}`,
    `Exported by ScaniPro ${deviceContext().appVersion} on ${new Date().toISOString()}`,
  ];
}

export async function exportExhibit(exhibitId: string, format: ExportFormat): Promise<void> {
  const l = await load(exhibitId);
  if (l.ex.kind === 'pdf') {
    throw new Error('Imported PDFs are kept exactly as received, so they can only be shared as PDF. Text, image, Word and PowerPoint export work on scanned or photographed pages.');
  }
  const base = `Exhibit-${padExhibitNumber(l.ex.number)}_${safeFileName(l.ex.title, 'Exhibit')}`;
  const now = new Date();
  let file: ExportedFile;

  if (format === 'text') {
    const body = l.pages.map((p) => `--- Page ${p.page_index + 1} ---\n${(p.ocr_text ?? '').trim() || '(no recognised text)'}`).join('\n\n');
    file = await saveExport(`${base}.txt`, utf8(`${l.ex.title}\n${provenance(l).join('\n')}\n\n${body}\n`), 'txt');
  } else if (format === 'images') {
    const pages = await verifiedPages(l.pages);
    if (pages.length === 1) {
      file = await saveExport(`${base}_page-1.jpg`, (pages[0] as { jpeg: Uint8Array }).jpeg, 'jpeg');
    } else {
      const zip = createZip(
        [
          ...pages.map(({ page, jpeg }) => ({ name: `${base}_page-${page.page_index + 1}.jpg`, data: jpeg })),
          { name: 'README.txt', data: utf8(`${provenance(l).join('\r\n')}\r\n\r\nPage SHA-256:\r\n${pages.map(({ page }) => `page ${page.page_index + 1}  ${page.sha256}`).join('\r\n')}\r\n`) },
        ],
        now,
      );
      file = await saveExport(`${base}_images.zip`, zip, 'zip');
    }
  } else if (format === 'docx') {
    const pages = await verifiedPages(l.pages);
    const docx = buildDocx({
      title: `Exhibit ${l.ex.number}: ${l.ex.title}`,
      meta: provenance(l),
      pages: pages.map(({ page, jpeg }) => ({ jpeg, width: page.width, height: page.height, text: page.ocr_text })),
      includeImages: true,
      createdAt: now,
    });
    file = await saveExport(`${base}.docx`, docx, 'docx');
  } else {
    const pages = await verifiedPages(l.pages);
    const pptx = buildPptx(
      pages.map(({ page, jpeg }) => ({ jpeg, width: page.width, height: page.height, caption: `Exhibit ${l.ex.number} · ${l.ex.title} · page ${page.page_index + 1} of ${pages.length}` })),
      `Exhibit ${l.ex.number}: ${l.ex.title}`,
      now,
    );
    file = await saveExport(`${base}.pptx`, pptx, 'pptx');
  }
  await logShare(l, format, file);
  await shareExport(file);
}

/** Combines the current versions of several exhibits into one PDF. */
export async function mergeExhibits(caseId: string, exhibitIds: string[]): Promise<ExportedFile> {
  const db = await getDb();
  const kase = await getCase(db, caseId);
  if (!kase) throw new Error('Case not found.');
  const loaded: { l: Loaded; bytes: Uint8Array }[] = [];
  for (const id of exhibitIds) {
    const l = await load(id);
    loaded.push({ l, bytes: await readBytes(l.version.file_path) });
  }
  loaded.sort((a, b) => a.l.ex.number - b.l.ex.number);
  const now = new Date();
  const pdf = await mergePdfs(
    loaded.map((x) => x.bytes),
    `${kase.title} - Exhibits ${loaded.map((x) => x.l.ex.number).join(', ')}`,
    now,
    deviceContext().appVersion,
  );
  const file = await saveExport(`Merged_${safeFileName(kase.reference || kase.title, 'Case')}_Ex-${loaded.map((x) => x.l.ex.number).join('-')}.pdf`, pdf, 'pdf');
  for (const { l } of loaded) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await appendCustody(tx, {
        exhibitId: l.ex.id,
        caseId,
        action: 'exported',
        fileSha256: l.version.sha256,
        timestamp: now.toISOString(),
        details: { format: 'merged-pdf', fileName: file.name, mergedSha256: file.sha256, withExhibits: loaded.map((x) => x.l.ex.number) },
      });
    });
  }
  notifyDataChanged();
  return file;
}

export type ExpenseDraft = Omit<ExpenseLine, 'fileSha256'> & { exhibitId: string };

export async function exportExpenseReport(caseId: string, drafts: ExpenseDraft[]): Promise<{ pdf: ExportedFile; csv: ExportedFile }> {
  if (!drafts.length) throw new Error('Include at least one receipt.');
  const db = await getDb();
  const kase = await getCase(db, caseId);
  if (!kase) throw new Error('Case not found.');
  const lines: ExpenseLine[] = [];
  const loadedById = new Map<string, Loaded>();
  for (const d of drafts) {
    const l = await load(d.exhibitId);
    loadedById.set(d.exhibitId, l);
    lines.push({ ...d, fileSha256: l.version.sha256 });
  }
  lines.sort((a, b) => a.exhibitNumber - b.exhibitNumber);
  const now = new Date();
  const input = { caseTitle: kase.title, caseReference: kase.reference, generatedAt: now, appVersion: deviceContext().appVersion, lines };
  const base = `ExpenseReport_${safeFileName(kase.reference || kase.title, 'Case')}_${now.toISOString().slice(0, 10)}`;
  const pdf = await saveExport(`${base}.pdf`, await buildExpensePdf(input), 'pdf');
  const csv = await saveExport(`${base}.csv`, utf8(expenseCsv(input)), 'csv');
  for (const d of drafts) {
    const l = loadedById.get(d.exhibitId) as Loaded;
    await db.withExclusiveTransactionAsync(async (tx) => {
      await appendCustody(tx, {
        exhibitId: l.ex.id,
        caseId,
        action: 'exported',
        fileSha256: l.version.sha256,
        timestamp: now.toISOString(),
        details: { format: 'expense-report', fileName: pdf.name, reportSha256: pdf.sha256, csvSha256: csv.sha256, amount: d.amount, currency: d.currency },
      });
    });
  }
  notifyDataChanged();
  return { pdf, csv };
}
