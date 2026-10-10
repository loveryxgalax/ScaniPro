export type ParsedReceipt = {
  merchant: string | null;
  date: string | null; // ISO YYYY-MM-DD when recognisable
  total: number | null;
  currency: string | null;
};

const CURRENCIES: [RegExp, string][] = [
  [/\bKSH\b|\bKES\b|KSh/i, 'KES'],
  [/€|\bEUR\b/i, 'EUR'],
  [/£|\bGBP\b/i, 'GBP'],
  [/\bCAD\b|C\$/i, 'CAD'],
  [/\bAUD\b|A\$/i, 'AUD'],
  [/\$|\bUSD\b/i, 'USD'],
];

const AMOUNT = /(?:^|[^\d.,])(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+[.,]\d{2})(?![\d])/g;
const TOTAL_WORDS = /\b(grand\s+total|total\s+due|amount\s+due|balance\s+due|total\s+amount|amount\s+paid|total)\b/i;
const NOT_TOTAL = /\b(sub\s*-?\s*total|tax|vat|tip|discount|change|savings|items?)\b/i;

function toNumber(raw: string): number {
  let s = raw.replace(/\s/g, '');
  // "1.234,56" (EU) vs "1,234.56" (US)
  if (/,\d{2}$/.test(s) && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/,\d{2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  return Number(s);
}

function amountsIn(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(AMOUNT)) {
    const n = toNumber(m[1] as string);
    if (Number.isFinite(n) && n > 0 && n < 10_000_000) out.push(n);
  }
  return out;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

function validIso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function findDate(text: string): string | null {
  let m = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
  if (m) return validIso(+m[1]!, +m[2]!, +m[3]!);
  m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(text);
  if (m) {
    const a = +m[1]!, b = +m[2]!, y = +m[3]!;
    // Prefer month/day when unambiguous US-style, otherwise day/month.
    return a > 12 ? validIso(y, b, a) : validIso(y, a, b) ?? validIso(y, b, a);
  }
  m = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{2,4})\b/i.exec(text);
  if (m) return validIso(+m[3]!, MONTHS.indexOf(m[2]!.toLowerCase().slice(0, 3)) + 1, +m[1]!);
  m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{2,4})\b/i.exec(text);
  if (m) return validIso(+m[3]!, MONTHS.indexOf(m[1]!.toLowerCase().slice(0, 3)) + 1, +m[2]!);
  return null;
}

/** Best-effort extraction of merchant, date and total from OCR text. Users confirm before export. */
export function parseReceipt(text: string): ParsedReceipt {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const merchant =
    lines.find((l) => l.length >= 3 && l.length <= 40 && /[a-z]{3}/i.test(l) && (l.match(/\d/g)?.length ?? 0) <= 3) ?? null;

  let total: number | null = null;
  for (let i = lines.length - 1; i >= 0 && total === null; i--) {
    const line = lines[i] as string;
    if (!TOTAL_WORDS.test(line) || NOT_TOTAL.test(line)) continue;
    const here = amountsIn(line);
    const next = here.length ? here : amountsIn(lines[i + 1] ?? '');
    if (next.length) total = Math.max(...next);
  }
  if (total === null) {
    const all = lines.flatMap(amountsIn);
    total = all.length ? Math.max(...all) : null;
  }

  const currency = CURRENCIES.find(([re]) => re.test(text))?.[1] ?? null;
  return { merchant, date: findDate(text), total, currency };
}

export function formatMoney(n: number, currency: string | null) {
  const s = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${s}` : s;
}
