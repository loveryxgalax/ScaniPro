import {
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  TextRenderingMode,
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  setFontAndSize,
  setTextMatrix,
  setTextRenderingMode,
  showText,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';

import { toWinAnsi } from './text';
import type { OcrLine } from './types';

export const PAGE_WIDTH_PT = 612; // US Letter width; height follows the scan's aspect ratio.

export type SearchablePageInput = {
  jpeg: Uint8Array;
  lines: OcrLine[];
};

export type PdfMeta = {
  title: string;
  subject?: string;
  keywords?: string[];
  /** Fixed timestamp so the same inputs always produce byte-identical output. */
  createdAt: Date;
  appVersion: string;
};

function applyMeta(doc: PDFDocument, meta: PdfMeta) {
  doc.setTitle(toWinAnsi(meta.title), { showInWindowTitleBar: true });
  if (meta.subject) doc.setSubject(toWinAnsi(meta.subject));
  if (meta.keywords) doc.setKeywords(meta.keywords.map(toWinAnsi));
  doc.setCreator(`CaseSeal ${meta.appVersion}`);
  doc.setProducer(`CaseSeal ${meta.appVersion} (pdf-lib)`);
  doc.setCreationDate(meta.createdAt);
  doc.setModificationDate(meta.createdAt);
}

export function createDeterministicDoc() {
  return PDFDocument.create({ updateMetadata: false });
}

export async function saveDeterministic(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: false, updateFieldAppearances: false });
}

/** Writes an invisible (render mode 3) text layer that matches the OCR line boxes. */
export function drawInvisibleText(page: PDFPage, font: PDFFont, lines: OcrLine[]) {
  const { width: pw, height: ph } = page.getSize();
  const fontKey = page.node.newFontDictionary(font.name, font.ref);
  const ops = [];
  for (const line of lines) {
    const text = toWinAnsi(line.text).trim();
    if (!text || line.width <= 0 || line.height <= 0) continue;
    const boxW = line.width * pw;
    const boxH = line.height * ph;
    const size = Math.max(1, boxH * 0.8);
    const natural = font.widthOfTextAtSize(text, size);
    if (natural <= 0) continue;
    const scaleX = boxW / natural;
    const x = line.x * pw;
    const y = ph - (line.y + line.height) * ph + boxH * 0.2;
    ops.push(
      beginText(),
      setFontAndSize(fontKey, size),
      setTextRenderingMode(TextRenderingMode.Invisible),
      setTextMatrix(scaleX, 0, 0, 1, x, y),
      showText(font.encodeText(text)),
      endText(),
    );
  }
  if (ops.length) page.pushOperators(pushGraphicsState(), ...ops, popGraphicsState());
}

/**
 * Builds the exhibit PDF: each scanned page image fills one page, with the
 * OCR text placed invisibly on top so the PDF is searchable and selectable.
 */
export async function buildSearchablePdf(pages: SearchablePageInput[], meta: PdfMeta): Promise<Uint8Array> {
  if (!pages.length) throw new Error('An exhibit needs at least one page');
  const doc = await createDeterministicDoc();
  applyMeta(doc, meta);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const input of pages) {
    const image = await doc.embedJpg(input.jpeg);
    const height = (PAGE_WIDTH_PT * image.height) / image.width;
    const page = doc.addPage([PAGE_WIDTH_PT, height]);
    page.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH_PT, height });
    drawInvisibleText(page, font, input.lines);
  }
  // Mark as a tagged scan so viewers know text is OCR-derived.
  doc.catalog.set(PDFName.of('Lang'), PDFString.of('en-US'));
  return saveDeterministic(doc);
}
