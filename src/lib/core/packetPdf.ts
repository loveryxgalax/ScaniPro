import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { fitText, wrapText } from './layout';
import { createDeterministicDoc, saveDeterministic } from './searchablePdf';
import { toWinAnsi } from './text';
import type { DeviceContext } from './types';

const W = 612;
const H = 792;
const M = 48;
const INK = rgb(0.07, 0.1, 0.16);
const MUTED = rgb(0.38, 0.42, 0.5);
const RULE = rgb(0.8, 0.83, 0.88);
const ACCENT = rgb(0.11, 0.25, 0.47);

export const INDEX_ROWS_PER_PAGE = 22;
export const MANIFEST_ROWS_PER_PAGE = 12;

export type PacketExhibit = {
  number: number;
  title: string;
  capturedAt: string;
  versionLabel: string;
  fileName: string;
  pdf: Uint8Array;
  sha256: string;
  captureDigest: string;
};

export type PacketInput = {
  caseTitle: string;
  caseReference?: string | null;
  matterDate?: string | null;
  generatedAt: Date;
  device: DeviceContext;
  exhibits: PacketExhibit[];
  withdrawn: number[];
  embedExhibitFiles: boolean;
};

export type PacketPageRange = { number: number; start: number; end: number; pageCount: number };

export type PacketResult = {
  pdf: Uint8Array;
  pageCount: number;
  exhibitPages: PacketPageRange[];
  manifestStartPage: number;
};

type Fonts = { regular: PDFFont; bold: PDFFont; mono: PDFFont };

function txt(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color = INK) {
  page.drawText(toWinAnsi(text), { x, y, size, font, color });
}

function rightTxt(page: PDFPage, text: string, xRight: number, y: number, size: number, font: PDFFont, color = INK) {
  const t = toWinAnsi(text);
  page.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y, size, font, color });
}

function rule(page: PDFPage, y: number, color = RULE, thickness = 0.75) {
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness, color });
}

function pageFooter(page: PDFPage, fonts: Fonts, left: string, n: number, total: number) {
  rule(page, 40);
  txt(page, fitText(toWinAnsi(left), fonts.regular, 8, 360), M, 28, 8, fonts.regular, MUTED);
  rightTxt(page, `Packet page ${n} of ${total}`, W - M, 28, 8, fonts.regular, MUTED);
}

function caseLabel(input: PacketInput) {
  return input.caseReference ? `${input.caseTitle} (Ref. ${input.caseReference})` : input.caseTitle;
}

export async function buildPacketPdf(input: PacketInput): Promise<PacketResult> {
  const doc = await createDeterministicDoc();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.Courier),
  };
  const exhibits = [...input.exhibits].sort((a, b) => a.number - b.number);

  // Pass 1: load sources so every page number is known before drawing.
  const sources = [];
  for (const ex of exhibits) {
    const src = await PDFDocument.load(ex.pdf, { updateMetadata: false });
    sources.push({ ex, src, count: src.getPageCount() });
  }
  const indexPages = Math.max(1, Math.ceil(exhibits.length / INDEX_ROWS_PER_PAGE));
  const manifestPages = Math.max(1, Math.ceil(exhibits.length / MANIFEST_ROWS_PER_PAGE));
  let cursor = 1 + indexPages + 1;
  const ranges: PacketPageRange[] = sources.map(({ ex, count }) => {
    const r = { number: ex.number, start: cursor, end: cursor + count - 1, pageCount: count };
    cursor += count;
    return r;
  });
  const manifestStartPage = cursor;
  const total = manifestStartPage + manifestPages - 1;
  const totalSourcePages = sources.reduce((n, s) => n + s.count, 0);
  const label = caseLabel(input);
  const iso = input.generatedAt.toISOString();

  // Cover
  {
    const page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 10, width: W, height: 10, color: ACCENT });
    txt(page, 'EVIDENCE PACKET', M, H - 96, 11, fonts.bold, ACCENT);
    let y = H - 140;
    for (const line of wrapText(toWinAnsi(input.caseTitle), fonts.bold, 26, W - 2 * M)) {
      txt(page, line, M, y, 26, fonts.bold);
      y -= 32;
    }
    y -= 8;
    const rows: [string, string][] = [
      ['Reference', input.caseReference || '-'],
      ['Matter date', input.matterDate || '-'],
      ['Exhibits', `${exhibits.length}${input.withdrawn.length ? ` (withdrawn: ${input.withdrawn.join(', ')})` : ''}`],
      ['Exhibit pages', String(totalSourcePages)],
      ['Packet pages', String(total)],
      ['Prepared (UTC)', iso],
      ['Prepared with', `CaseSeal ${input.device.appVersion} (${input.device.appBuild})`],
      ['Device', `${input.device.deviceModel}, ${input.device.osName} ${input.device.osVersion}`],
    ];
    rule(page, y);
    y -= 22;
    for (const [k, v] of rows) {
      txt(page, k.toUpperCase(), M, y, 8, fonts.bold, MUTED);
      txt(page, fitText(toWinAnsi(v), fonts.regular, 11, W - 2 * M - 130), M + 130, y, 11, fonts.regular);
      y -= 22;
    }
    rule(page, y + 8);
    y -= 24;
    txt(page, 'INTEGRITY STATEMENT', M, y, 8, fonts.bold, MUTED);
    y -= 16;
    const statement =
      'Every exhibit in this packet was captured with CaseSeal on the device named above. At the moment of capture, ' +
      'each page image was hashed with SHA-256 and the result recorded in an append-only, hash-chained custody log. ' +
      `The SHA-256 of each exhibit file is listed in the Hash Manifest beginning on packet page ${manifestStartPage}. ` +
      (input.embedExhibitFiles
        ? 'The exact exhibit files are embedded in this PDF as attachments, so any recipient can extract them and ' +
          'recompute their SHA-256 independently. '
        : '') +
      'The SHA-256 of this packet file itself is recorded in the accompanying manifest.json and manifest.csv.';
    for (const line of wrapText(statement, fonts.regular, 10, W - 2 * M)) {
      txt(page, line, M, y, 10, fonts.regular);
      y -= 14;
    }
    pageFooter(page, fonts, label, 1, total);
  }

  // Exhibit index
  for (let p = 0; p < indexPages; p++) {
    const page = doc.addPage([W, H]);
    txt(page, p === 0 ? 'Exhibit Index' : 'Exhibit Index (continued)', M, H - 72, 18, fonts.bold);
    let y = H - 104;
    const cols = { no: M, title: M + 64, captured: M + 330, pages: W - M - 70, start: W - M };
    txt(page, 'EXHIBIT', cols.no, y, 8, fonts.bold, MUTED);
    txt(page, 'TITLE', cols.title, y, 8, fonts.bold, MUTED);
    txt(page, 'CAPTURED (UTC)', cols.captured, y, 8, fonts.bold, MUTED);
    rightTxt(page, 'PAGES', cols.pages + 30, y, 8, fonts.bold, MUTED);
    rightTxt(page, 'AT PAGE', cols.start, y, 8, fonts.bold, MUTED);
    y -= 8;
    rule(page, y);
    y -= 18;
    for (const r of ranges.slice(p * INDEX_ROWS_PER_PAGE, (p + 1) * INDEX_ROWS_PER_PAGE)) {
      const ex = exhibits.find((e) => e.number === r.number) as PacketExhibit;
      txt(page, String(ex.number), cols.no, y, 10, fonts.bold);
      txt(page, fitText(toWinAnsi(`${ex.title} (${ex.versionLabel})`), fonts.regular, 10, 255), cols.title, y, 10, fonts.regular);
      txt(page, ex.capturedAt.slice(0, 16).replace('T', ' '), cols.captured, y, 9, fonts.regular, MUTED);
      rightTxt(page, String(r.pageCount), cols.pages + 30, y, 10, fonts.regular);
      rightTxt(page, String(r.start), cols.start, y, 10, fonts.regular);
      y -= 8;
      rule(page, y, rgb(0.92, 0.93, 0.95), 0.5);
      y -= 18;
    }
    if (p === indexPages - 1) {
      y -= 6;
      txt(page, 'Hash Manifest', cols.title, y, 10, fonts.bold);
      rightTxt(page, String(manifestStartPage), cols.start, y, 10, fonts.bold);
    }
    pageFooter(page, fonts, label, 2 + p, total);
  }

  // Exhibits with headers and footers
  const box = { x: M - 12, y: 52, w: W - 2 * (M - 12), h: H - 52 - 76 };
  for (let i = 0; i < sources.length; i++) {
    const { ex, src } = sources[i] as (typeof sources)[number];
    const range = ranges[i] as PacketPageRange;
    const embedded = await doc.embedPdf(src, src.getPageIndices());
    embedded.forEach((ep, j) => {
      const page = doc.addPage([W, H]);
      const scale = Math.min(box.w / ep.width, box.h / ep.height);
      const dw = ep.width * scale;
      const dh = ep.height * scale;
      const dx = box.x + (box.w - dw) / 2;
      const dy = box.y + (box.h - dh) / 2;
      page.drawPage(ep, { x: dx, y: dy, width: dw, height: dh });
      page.drawRectangle({ x: dx, y: dy, width: dw, height: dh, borderColor: RULE, borderWidth: 0.5 });

      page.drawRectangle({ x: M - 12, y: H - 58, width: 92, height: 24, color: ACCENT });
      txt(page, `EXHIBIT ${ex.number}`, M - 4, H - 50, 12, fonts.bold, rgb(1, 1, 1));
      rightTxt(page, fitText(toWinAnsi(ex.title), fonts.bold, 10, 380), W - M + 12, H - 44, 10, fonts.bold);
      rightTxt(page, `${ex.versionLabel} | SHA-256 ${ex.sha256.slice(0, 16)}...`, W - M + 12, H - 56, 7, fonts.mono, MUTED);

      page.drawLine({ start: { x: M - 12, y: 44 }, end: { x: W - M + 12, y: 44 }, thickness: 0.5, color: RULE });
      txt(
        page,
        fitText(toWinAnsi(`${label} | Exhibit ${ex.number} | Page ${j + 1} of ${range.pageCount}`), fonts.regular, 8, 380),
        M - 12,
        30,
        8,
        fonts.regular,
        MUTED,
      );
      rightTxt(page, `Packet page ${range.start + j} of ${total}`, W - M + 12, 30, 8, fonts.regular, MUTED);
    });
  }

  // Hash manifest
  for (let p = 0; p < manifestPages; p++) {
    const page = doc.addPage([W, H]);
    txt(page, p === 0 ? 'Hash Manifest' : 'Hash Manifest (continued)', M, H - 72, 18, fonts.bold);
    let y = H - 92;
    if (p === 0) {
      const intro =
        'SHA-256 = hash of the exhibit PDF file as exported. Capture digest = SHA-256 over the ordered SHA-256 ' +
        'values of the original page images, fixed at the moment of capture. To verify an extracted exhibit ' +
        'file on a computer, run: shasum -a 256 <file> (macOS/Linux) or certutil -hashfile <file> SHA256 (Windows).';
      for (const line of wrapText(intro, fonts.regular, 8.5, W - 2 * M)) {
        txt(page, line, M, y, 8.5, fonts.regular, MUTED);
        y -= 12;
      }
    }
    y -= 10;
    rule(page, y);
    y -= 16;
    for (const ex of exhibits.slice(p * MANIFEST_ROWS_PER_PAGE, (p + 1) * MANIFEST_ROWS_PER_PAGE)) {
      const r = ranges.find((x) => x.number === ex.number) as PacketPageRange;
      txt(page, `Ex. ${ex.number}`, M, y, 10, fonts.bold);
      txt(page, fitText(toWinAnsi(ex.title), fonts.bold, 10, 300), M + 52, y, 10, fonts.bold);
      rightTxt(page, `pp. ${r.start}-${r.end}`, W - M, y, 9, fonts.regular, MUTED);
      y -= 13;
      txt(page, toWinAnsi(`${ex.fileName} | ${ex.versionLabel} | captured ${ex.capturedAt}`), M + 52, y, 7.5, fonts.regular, MUTED);
      y -= 12;
      txt(page, 'SHA-256', M + 52, y, 7, fonts.bold, MUTED);
      txt(page, ex.sha256, M + 120, y, 7.5, fonts.mono);
      y -= 11;
      txt(page, 'CAPTURE', M + 52, y, 7, fonts.bold, MUTED);
      txt(page, ex.captureDigest, M + 120, y, 7.5, fonts.mono);
      y -= 10;
      rule(page, y, rgb(0.92, 0.93, 0.95), 0.5);
      y -= 16;
    }
    if (p === manifestPages - 1) {
      y -= 4;
      txt(page, `Generated ${iso} by CaseSeal ${input.device.appVersion}. All processing performed on-device.`, M, y, 8, fonts.regular, MUTED);
    }
    pageFooter(page, fonts, label, manifestStartPage + p, total);
  }

  if (input.embedExhibitFiles) {
    for (const ex of exhibits) {
      await doc.attach(ex.pdf, ex.fileName, {
        mimeType: 'application/pdf',
        description: toWinAnsi(`Exhibit ${ex.number}: ${ex.title} - SHA-256 ${ex.sha256}`),
        creationDate: input.generatedAt,
        modificationDate: input.generatedAt,
      });
    }
  }

  doc.setTitle(toWinAnsi(`Evidence Packet - ${input.caseTitle}`), { showInWindowTitleBar: true });
  doc.setSubject(toWinAnsi(label));
  doc.setCreator(`CaseSeal ${input.device.appVersion}`);
  doc.setProducer(`CaseSeal ${input.device.appVersion} (pdf-lib)`);
  doc.setCreationDate(input.generatedAt);
  doc.setModificationDate(input.generatedAt);

  const pdf = await saveDeterministic(doc);
  return { pdf, pageCount: total, exhibitPages: ranges, manifestStartPage };
}
