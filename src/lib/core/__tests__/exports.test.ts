/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PDFDocument } from 'pdf-lib';

import { buildDocx } from '../docx';
import { buildExpensePdf, expenseCsv, expenseTotals } from '../expense';
import { mergePdfs } from '../merge';
import { buildPptx } from '../pptx';
import { findDate, parseReceipt } from '../receipt';
import { buildSearchablePdf } from '../searchablePdf';
import { xmlEscape } from '../xml';
import { fixtureJpeg } from './helpers';

const createdAt = new Date('2026-10-06T12:00:00.000Z');

function tmpFile(name: string, data: Uint8Array) {
  const file = join(mkdtempSync(join(tmpdir(), 'exp-')), name);
  writeFileSync(file, data);
  return file;
}

function python(code: string, file: string): string | null {
  try {
    return execFileSync('python3', ['-c', code, file]).toString().trim();
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: Buffer };
    if (err.code === 'ENOENT' || /No module named/.test(err.stderr?.toString() ?? '')) return null;
    throw new Error(err.stderr?.toString() ?? String(e));
  }
}

describe('xmlEscape', () => {
  it('escapes markup and strips invalid control characters', () => {
    expect(xmlEscape('a<b>&"c\'\u0001')).toBe('a&lt;b&gt;&amp;&quot;c&apos;');
  });
});

describe('docx export', () => {
  it('produces a document Word-compatible parsers can open', () => {
    const docx = buildDocx({
      title: 'Exhibit 3: Lease <draft>',
      meta: ['Case: Smith v. Jones', `SHA-256 ${'a'.repeat(64)}`],
      pages: [
        { jpeg: fixtureJpeg(), width: 850, height: 1100, text: 'LEASE AGREEMENT\nTenant: Jane Example' },
        { jpeg: fixtureJpeg(), width: 850, height: 1100, text: '' },
      ],
      includeImages: true,
      createdAt,
    });
    const out = python(
      "import sys,docx; d=docx.Document(sys.argv[1]); print(len(d.inline_shapes)); print('|'.join(p.text for p in d.paragraphs if p.text))",
      tmpFile('t.docx', docx),
    );
    if (out === null) return;
    const [shapes, text] = out.split('\n');
    expect(shapes).toBe('2');
    expect(text).toContain('Exhibit 3: Lease <draft>');
    expect(text).toContain('Tenant: Jane Example');
    expect(text).toContain('(No recognised text on this page.)');
  });
});

describe('pptx export', () => {
  it('produces a presentation with one picture slide per page', () => {
    const pptx = buildPptx(
      [
        { jpeg: fixtureJpeg(), width: 850, height: 1100, caption: 'Exhibit 1 - page 1' },
        { jpeg: fixtureJpeg(), width: 850, height: 1100, caption: 'Exhibit 1 - page 2' },
      ],
      'Exhibit 1',
      createdAt,
    );
    const out = python(
      "import sys,pptx; p=pptx.Presentation(sys.argv[1]); print(len(p.slides)); print(sum(1 for s in p.slides for sh in s.shapes if sh.shape_type==13)); print(p.slides[1].shapes[1].text_frame.text)",
      tmpFile('t.pptx', pptx),
    );
    if (out === null) return;
    expect(out.split('\n')).toEqual(['2', '2', 'Exhibit 1 - page 2']);
  });

  it('refuses an empty presentation', () => {
    expect(() => buildPptx([], 'x', createdAt)).toThrow();
  });
});

describe('merge', () => {
  it('concatenates pages in order', async () => {
    const a = await buildSearchablePdf([{ jpeg: fixtureJpeg(), lines: [] }, { jpeg: fixtureJpeg(), lines: [] }], { title: 'a', createdAt, appVersion: '1' });
    const b = await buildSearchablePdf([{ jpeg: fixtureJpeg(), lines: [] }], { title: 'b', createdAt, appVersion: '1' });
    const merged = await mergePdfs([a, b], 'Merged', createdAt, '1.0.0');
    expect((await PDFDocument.load(merged)).getPageCount()).toBe(3);
    await expect(mergePdfs([a], 'x', createdAt, '1')).rejects.toThrow();
  });
});

describe('receipt parsing', () => {
  it('reads merchant, date, total and currency', () => {
    const r = parseReceipt(['JAVA HOUSE', 'Mombasa Rd, Nairobi', '12/09/2026 14:02', 'Latte 1 350.00', 'Muffin 1 250.00', 'Subtotal 600.00', 'VAT 16% 96.00', 'TOTAL KES 696.00', 'Cash 1,000.00', 'Change 304.00'].join('\n'));
    expect(r).toEqual({ merchant: 'JAVA HOUSE', date: '2026-12-09', total: 696, currency: 'KES' });
  });
  it('handles amounts on the next line and thousands separators', () => {
    expect(parseReceipt('Home Depot\nOct 3, 2026\nAmount due\n$1,284.50').total).toBe(1284.5);
    expect(parseReceipt('Home Depot\nOct 3, 2026\nAmount due\n$1,284.50').date).toBe('2026-10-03');
  });
  it('falls back to the largest amount', () => {
    expect(parseReceipt('Shop\n2.50\n19.99\n4.00').total).toBe(19.99);
    expect(parseReceipt('Shop\nLatte 1 350.00').total).toBe(350);
  });
  it('understands European decimals and day-first dates', () => {
    expect(parseReceipt('Café\n25/08/2026\nTotal 1.234,56 €')).toMatchObject({ total: 1234.56, currency: 'EUR', date: '2026-08-25' });
    expect(findDate('nothing here')).toBeNull();
  });
});

describe('expense report', () => {
  const input = {
    caseTitle: 'Storm claim',
    caseReference: 'CLM-1',
    generatedAt: createdAt,
    appVersion: '1.0.0',
    lines: [
      { exhibitNumber: 1, exhibitTitle: 'Hotel', date: '2026-08-01', merchant: 'Inn', amount: 120.5, currency: 'USD', fileSha256: 'a'.repeat(64) },
      { exhibitNumber: 2, exhibitTitle: '=Taxi', date: null, merchant: null, amount: 30, currency: 'USD', fileSha256: 'b'.repeat(64) },
      { exhibitNumber: 3, exhibitTitle: 'Meal', date: null, merchant: null, amount: 2000, currency: 'KES', fileSha256: 'c'.repeat(64) },
    ],
  };
  it('totals per currency', () => {
    expect(expenseTotals(input.lines)).toEqual([{ currency: 'USD', total: 150.5 }, { currency: 'KES', total: 2000 }]);
  });
  it('writes a safe CSV and a PDF with totals', async () => {
    const csv = expenseCsv(input);
    expect(csv).toContain(`"'=Taxi"`);
    expect(csv).toContain(',TOTAL,,,150.50,USD,');
    const pdf = await buildExpensePdf(input);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
    try {
      const text = execFileSync('pdftotext', [tmpFile('e.pdf', pdf), '-']).toString();
      expect(text).toContain('EXPENSE REPORT');
      expect(text).toContain('USD 150.50');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  });
});
