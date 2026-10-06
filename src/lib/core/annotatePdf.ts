import { LineCapStyle, PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { hexToRgb } from './color';
import { saveDeterministic } from './searchablePdf';
import { toWinAnsi } from './text';
import type { Annotation, NormPoint } from './types';

export type DerivedStamp = {
  /** e.g. "Derived version 2 of Exhibit 3" */
  label: string;
  baseSha256: string;
  createdAt: Date;
  appVersion: string;
};

function pathFor(points: NormPoint[], w: number, h: number): string {
  if (!points.length) return '';
  const [first, ...rest] = points;
  const f = first as NormPoint;
  let d = `M ${(f[0] * w).toFixed(2)} ${(f[1] * h).toFixed(2)}`;
  if (!rest.length) d += ` L ${(f[0] * w + 0.01).toFixed(2)} ${(f[1] * h).toFixed(2)}`;
  for (const [x, y] of rest) d += ` L ${(x * w).toFixed(2)} ${(y * h).toFixed(2)}`;
  return d;
}

/**
 * Produces a derived PDF: the base PDF's pages untouched, with annotations
 * and signatures drawn on top and a provenance footer on every page.
 * The base file is never modified; the caller stores the result separately.
 */
export async function applyAnnotations(
  basePdf: Uint8Array,
  annotations: Annotation[],
  stamp: DerivedStamp,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(basePdf, { updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (const a of annotations) {
    const page = pages[a.pageIndex];
    if (!page) continue;
    const { width: w, height: h } = page.getSize();
    if (a.kind === 'text') {
      const size = Math.max(4, a.size * w);
      page.drawText(toWinAnsi(a.text), {
        x: a.x * w,
        y: h - a.y * h - size,
        size,
        font,
        color: hexToRgb(a.color),
      });
    } else {
      const d = pathFor(a.points, w, h);
      if (!d) continue;
      page.drawSvgPath(d, {
        x: 0,
        y: h,
        borderColor: hexToRgb(a.color),
        borderWidth: Math.max(0.5, a.width * w),
        borderLineCap: LineCapStyle.Round,
      });
    }
  }

  const footer = toWinAnsi(
    `${stamp.label} | base SHA-256 ${stamp.baseSha256} | CaseSeal ${stamp.appVersion}`,
  );
  for (const page of pages) {
    const { width } = page.getSize();
    let size = 6;
    while (size > 3 && font.widthOfTextAtSize(footer, size) > width - 16) size -= 0.25;
    page.drawRectangle({ x: 0, y: 0, width, height: size + 6, color: rgb(1, 1, 1), opacity: 0.85 });
    page.drawText(footer, { x: 8, y: 3, size, font, color: rgb(0.25, 0.25, 0.3) });
  }

  doc.setModificationDate(stamp.createdAt);
  doc.setProducer(`CaseSeal ${stamp.appVersion} (pdf-lib)`);
  return saveDeterministic(doc);
}
