import { StandardFonts, rgb } from 'pdf-lib';

import { fitText } from './layout';
import { csvCell } from './manifest';
import { formatMoney } from './receipt';
import { createDeterministicDoc, saveDeterministic } from './searchablePdf';
import { toWinAnsi } from './text';

export type ExpenseLine = {
  exhibitNumber: number;
  exhibitTitle: string;
  date: string | null;
  merchant: string | null;
  amount: number;
  currency: string | null;
  fileSha256: string;
};

export type ExpenseInput = {
  caseTitle: string;
  caseReference: string | null;
  generatedAt: Date;
  appVersion: string;
  lines: ExpenseLine[];
};

export function expenseTotals(lines: ExpenseLine[]): { currency: string | null; total: number }[] {
  const map = new Map<string, number>();
  for (const l of lines) map.set(l.currency ?? '', (map.get(l.currency ?? '') ?? 0) + l.amount);
  return [...map.entries()].map(([c, total]) => ({ currency: c || null, total: Math.round(total * 100) / 100 }));
}

export function expenseCsv(input: ExpenseInput): string {
  const rows = [['exhibit_number', 'exhibit_title', 'date', 'merchant', 'amount', 'currency', 'exhibit_sha256'].join(',')];
  for (const l of input.lines) {
    rows.push([l.exhibitNumber, l.exhibitTitle, l.date, l.merchant, l.amount.toFixed(2), l.currency, l.fileSha256].map(csvCell).join(','));
  }
  for (const t of expenseTotals(input.lines)) rows.push(['', 'TOTAL', '', '', t.total.toFixed(2), t.currency, ''].map(csvCell).join(','));
  return `${rows.join('\r\n')}\r\n`;
}

/** One-page-per-~28-lines expense report with totals and exhibit hashes. */
export async function buildExpensePdf(input: ExpenseInput): Promise<Uint8Array> {
  const doc = await createDeterministicDoc();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const W = 612, H = 792, M = 48;
  const ink = rgb(0.07, 0.09, 0.16), muted = rgb(0.4, 0.43, 0.52), accent = rgb(0.31, 0.36, 0.96);
  const perPage = 26;
  const pages = Math.max(1, Math.ceil(input.lines.length / perPage));
  const cols = { no: M, title: M + 40, date: M + 230, merchant: M + 300, amount: W - M };

  for (let p = 0; p < pages; p++) {
    const page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: accent });
    let y = H - 64;
    if (p === 0) {
      page.drawText('EXPENSE REPORT', { x: M, y, size: 10, font: bold, color: accent });
      y -= 26;
      page.drawText(fitText(toWinAnsi(input.caseTitle), bold, 20, W - 2 * M), { x: M, y, size: 20, font: bold, color: ink });
      y -= 18;
      const sub = `${input.caseReference ? `Ref. ${input.caseReference} | ` : ''}Generated ${input.generatedAt.toISOString()} | ${input.lines.length} receipts`;
      page.drawText(toWinAnsi(sub), { x: M, y, size: 9, font, color: muted });
      y -= 30;
    }
    const head = (t: string, x: number, right = false) =>
      page.drawText(t, { x: right ? x - bold.widthOfTextAtSize(t, 8) : x, y, size: 8, font: bold, color: muted });
    head('EX.', cols.no); head('DESCRIPTION', cols.title); head('DATE', cols.date); head('MERCHANT', cols.merchant); head('AMOUNT', cols.amount, true);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.75, color: rgb(0.85, 0.87, 0.92) });
    y -= 16;
    for (const l of input.lines.slice(p * perPage, (p + 1) * perPage)) {
      page.drawText(String(l.exhibitNumber), { x: cols.no, y, size: 9.5, font: bold, color: ink });
      page.drawText(fitText(toWinAnsi(l.exhibitTitle), font, 9.5, 180), { x: cols.title, y, size: 9.5, font, color: ink });
      page.drawText(l.date ?? '-', { x: cols.date, y, size: 9, font, color: muted });
      page.drawText(fitText(toWinAnsi(l.merchant ?? '-'), font, 9, 150), { x: cols.merchant, y, size: 9, font, color: muted });
      const amt = toWinAnsi(formatMoney(l.amount, l.currency));
      page.drawText(amt, { x: cols.amount - font.widthOfTextAtSize(amt, 9.5), y, size: 9.5, font, color: ink });
      y -= 11;
      page.drawText(`SHA-256 ${l.fileSha256}`, { x: cols.title, y, size: 5.5, font: mono, color: muted });
      y -= 12;
    }
    if (p === pages - 1) {
      y -= 4;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: ink });
      y -= 18;
      for (const t of expenseTotals(input.lines)) {
        const label = `Total${t.currency ? ` (${t.currency})` : ''}`;
        const amt = toWinAnsi(formatMoney(t.total, t.currency));
        page.drawText(label, { x: cols.merchant, y, size: 11, font: bold, color: ink });
        page.drawText(amt, { x: cols.amount - bold.widthOfTextAtSize(amt, 11), y, size: 11, font: bold, color: ink });
        y -= 16;
      }
      y -= 10;
      page.drawText('Amounts were read from receipts with on-device OCR and confirmed by the user. Each line links to a sealed exhibit.', {
        x: M, y, size: 7.5, font, color: muted,
      });
    }
    const footer = `ScaniPro ${input.appVersion} | page ${p + 1} of ${pages}`;
    page.drawText(footer, { x: W - M - font.widthOfTextAtSize(footer, 8), y: 28, size: 8, font, color: muted });
  }
  doc.setTitle(toWinAnsi(`Expense report - ${input.caseTitle}`));
  doc.setProducer(`ScaniPro ${input.appVersion} (pdf-lib)`);
  doc.setCreationDate(input.generatedAt);
  doc.setModificationDate(input.generatedAt);
  return saveDeterministic(doc);
}
