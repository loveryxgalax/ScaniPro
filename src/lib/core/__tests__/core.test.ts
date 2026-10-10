/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PDFDocument } from 'pdf-lib';

import { applyAnnotations } from '../annotatePdf';
import { canonicalJson } from '../canonical';
import { GENESIS_HASH, captureDigest, hashCustodyEntry, verifyChain, type CustodyEntry } from '../custody';
import { jpegSize } from '../jpeg';
import { canAddExhibit, canCreateCase, canUse } from '../limits';
import { buildManifest, csvCell, manifestToCsv } from '../manifest';
import { buildPacketPdf } from '../packetPdf';
import { toFtsQuery } from '../search';
import { buildSearchablePdf } from '../searchablePdf';
import { safeFileName, toWinAnsi } from '../text';
import { crc32, createZip } from '../zip';
import { device, fixtureJpeg, sha256 } from './helpers';

const createdAt = new Date('2026-10-06T12:00:00.000Z');

function hasPdftotext() {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function pdfText(bytes: Uint8Array): string {
  const dir = mkdtempSync(join(tmpdir(), 'caseseal-'));
  const file = join(dir, 'f.pdf');
  writeFileSync(file, bytes);
  return execFileSync('pdftotext', ['-layout', file, '-']).toString();
}

describe('text helpers', () => {
  it('replaces characters the standard fonts cannot encode', () => {
    expect(toWinAnsi('Café – “quoted” 日本 😀')).toBe('Café – “quoted” ?? ?');
  });
  it('makes safe file names', () => {
    expect(safeFileName('Smith v. Jones / Lease: 2026')).toBe('Smith-v.-Jones-Lease-2026');
    expect(safeFileName('日本')).toBe('file');
  });
});

describe('jpegSize', () => {
  it('reads dimensions', () => {
    expect(jpegSize(fixtureJpeg())).toEqual({ width: 850, height: 1100 });
  });
  it('rejects non-JPEG data', () => {
    expect(() => jpegSize(new Uint8Array([1, 2, 3]))).toThrow();
  });
});

describe('canonicalJson', () => {
  it('sorts keys recursively and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[2,{"y":2,"z":1}]},"b":1}');
  });
});

describe('custody chain', () => {
  async function makeChain(n: number): Promise<CustodyEntry[]> {
    const out: CustodyEntry[] = [];
    let prev = GENESIS_HASH;
    for (let i = 1; i <= n; i++) {
      const fields = {
        ...device,
        exhibitId: 'ex1',
        seq: i,
        timestamp: new Date(createdAt.getTime() + i * 1000).toISOString(),
        action: i === 1 ? ('captured' as const) : ('renamed' as const),
        details: { i },
        fileSha256: 'a'.repeat(64),
        prevEntryHash: prev,
      };
      const entryHash = await hashCustodyEntry(fields, sha256);
      out.push({ ...fields, entryHash });
      prev = entryHash;
    }
    return out;
  }

  it('verifies an intact chain', async () => {
    expect(await verifyChain(await makeChain(4), sha256)).toEqual({ ok: true, entries: 4 });
  });

  it('detects edited, removed and reordered entries', async () => {
    const edited = await makeChain(4);
    (edited[1] as CustodyEntry).details = { i: 99 };
    expect(await verifyChain(edited, sha256)).toMatchObject({ ok: false, brokenAtSeq: 2 });

    const removed = await makeChain(4);
    removed.splice(1, 1);
    expect(await verifyChain(removed, sha256)).toMatchObject({ ok: false, brokenAtSeq: 3 });

    const swapped = await makeChain(3);
    const [a, b] = [swapped[1] as CustodyEntry, swapped[2] as CustodyEntry];
    swapped[1] = { ...b, seq: 2 };
    swapped[2] = { ...a, seq: 3 };
    expect((await verifyChain(swapped, sha256)).ok).toBe(false);
  });

  it('computes an order-sensitive capture digest', async () => {
    const a = await captureDigest(['1', '2'], sha256);
    const b = await captureDigest(['2', '1'], sha256);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe('searchable PDF', () => {
  const lines = [
    { text: 'LEASE AGREEMENT', x: 0.094, y: 0.09, width: 0.3, height: 0.02 },
    { text: 'Tenant: Jane Example', x: 0.094, y: 0.145, width: 0.35, height: 0.02 },
  ];

  it('is deterministic for identical inputs', async () => {
    const meta = { title: 'Lease', createdAt, appVersion: '1.0.0' };
    const one = await buildSearchablePdf([{ jpeg: fixtureJpeg(), lines }], meta);
    const two = await buildSearchablePdf([{ jpeg: fixtureJpeg(), lines }], meta);
    expect(await sha256(one)).toBe(await sha256(two));
  });

  it('embeds an invisible, extractable text layer', async () => {
    const pdf = await buildSearchablePdf([{ jpeg: fixtureJpeg(), lines }, { jpeg: fixtureJpeg(), lines: [] }], {
      title: 'Lease 日本',
      createdAt,
      appVersion: '1.0.0',
    });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getWidth()).toBe(612);
    expect(Math.round(doc.getPage(0).getHeight())).toBe(792);
    if (hasPdftotext()) {
      const text = pdfText(pdf);
      expect(text).toContain('LEASE AGREEMENT');
      expect(text).toContain('Tenant: Jane Example');
    }
  });

  it('rejects an empty exhibit', async () => {
    await expect(buildSearchablePdf([], { title: 'x', createdAt, appVersion: '1' })).rejects.toThrow();
  });
});

describe('derived versions', () => {
  it('creates a new file and leaves the base untouched', async () => {
    const base = await buildSearchablePdf([{ jpeg: fixtureJpeg(), lines: [] }], { title: 'b', createdAt, appVersion: '1' });
    const baseCopy = base.slice();
    const baseHash = await sha256(base);
    const derived = await applyAnnotations(
      base,
      [
        { kind: 'signature', pageIndex: 0, color: '#1d3a8a', width: 0.004, points: [[0.1, 0.8], [0.2, 0.82], [0.3, 0.79]] },
        { kind: 'text', pageIndex: 0, color: '#c00000', size: 0.03, x: 0.1, y: 0.1, text: 'Reviewed' },
        { kind: 'ink', pageIndex: 5, color: '#000000', width: 0.01, points: [[0.5, 0.5]] },
      ],
      { label: 'Derived version 2 of Exhibit 1', baseSha256: baseHash, createdAt, appVersion: '1.0.0' },
    );
    expect(base).toEqual(baseCopy);
    expect(await sha256(derived)).not.toBe(baseHash);
    if (hasPdftotext()) {
      const text = pdfText(derived);
      expect(text).toContain('Reviewed');
      expect(text).toContain(baseHash);
    }
  });
});

describe('evidence packet', () => {
  it('lays out cover, index, exhibits and manifest with correct page numbers', async () => {
    const ex1 = await buildSearchablePdf([{ jpeg: fixtureJpeg(), lines: [] }, { jpeg: fixtureJpeg(), lines: [] }], {
      title: 'Lease',
      createdAt,
      appVersion: '1',
    });
    const ex2 = await buildSearchablePdf([{ jpeg: fixtureJpeg(), lines: [] }], { title: 'Letter', createdAt, appVersion: '1' });
    const exhibits = [
      { number: 2, title: 'Letter', capturedAt: createdAt.toISOString(), versionLabel: 'Original', fileName: 'Exhibit-002.pdf', pdf: ex2, sha256: await sha256(ex2), captureDigest: 'c'.repeat(64) },
      { number: 1, title: 'Lease', capturedAt: createdAt.toISOString(), versionLabel: 'Original', fileName: 'Exhibit-001.pdf', pdf: ex1, sha256: await sha256(ex1), captureDigest: 'd'.repeat(64) },
    ];
    const result = await buildPacketPdf({
      caseTitle: 'Smith v. Jones',
      caseReference: 'CV-2026-0142',
      matterDate: '2026-09-01',
      generatedAt: createdAt,
      device,
      exhibits,
      withdrawn: [3],
      embedExhibitFiles: true,
    });
    // cover(1) + index(1) + 2 + 1 exhibit pages + manifest(1)
    expect(result.pageCount).toBe(6);
    expect(result.exhibitPages).toEqual([
      { number: 1, start: 3, end: 4, pageCount: 2 },
      { number: 2, start: 5, end: 5, pageCount: 1 },
    ]);
    expect(result.manifestStartPage).toBe(6);
    const doc = await PDFDocument.load(result.pdf);
    expect(doc.getPageCount()).toBe(6);
    if (hasPdftotext()) {
      const text = pdfText(result.pdf);
      expect(text).toContain('EVIDENCE PACKET');
      expect(text).toContain('Exhibit Index');
      expect(text).toContain('EXHIBIT 1');
      expect(text).toContain('Hash Manifest');
      expect(text).toContain(exhibits[0]!.sha256);
      expect(text).toContain('Packet page 6 of 6');
    }
  });

  it('paginates long indexes', async () => {
    const pdf = await buildSearchablePdf([{ jpeg: fixtureJpeg(), lines: [] }], { title: 'x', createdAt, appVersion: '1' });
    const hash = await sha256(pdf);
    const exhibits = Array.from({ length: 30 }, (_, i) => ({
      number: i + 1, title: `Doc ${i + 1}`, capturedAt: createdAt.toISOString(), versionLabel: 'Original',
      fileName: `Exhibit-${i + 1}.pdf`, pdf, sha256: hash, captureDigest: hash,
    }));
    const result = await buildPacketPdf({ caseTitle: 'Big', generatedAt: createdAt, device, exhibits, withdrawn: [], embedExhibitFiles: false });
    // cover 1 + index 2 + 30 exhibits + manifest 3
    expect(result.pageCount).toBe(36);
    expect(result.exhibitPages[0]?.start).toBe(4);
    expect(result.manifestStartPage).toBe(34);
  });
});

describe('manifest', () => {
  it('builds JSON and a CSV safe for spreadsheets', () => {
    const m = buildManifest({
      generatedAt: createdAt,
      device,
      caseInfo: { id: 'c1', title: 'Case', reference: null, matterDate: null },
      packet: { fileName: 'p.pdf', sha256: 'f'.repeat(64), bytes: 10, pageCount: 4, exhibitFilesEmbedded: true },
      exhibits: [
        {
          number: 1, exhibitId: 'e1', title: '=HYPERLINK("x"), "quoted"', capturedAt: createdAt.toISOString(),
          captureDigest: 'c'.repeat(64), pages: [{ index: 0, sha256: 'a'.repeat(64), width: 1, height: 1 }],
          file: { name: 'Exhibit-001.pdf', version: 1, kind: 'original', sha256: 'b'.repeat(64), bytes: 5 },
          versions: [], custody: [], custodyChainValid: true,
        },
      ],
      ranges: [{ number: 1, start: 3, end: 3, pageCount: 1 }],
      withdrawn: [],
    });
    expect(m.exhibits[0]?.packetPages).toEqual({ start: 3, end: 3 });
    const csv = manifestToCsv(m);
    expect(csv.split('\r\n')[0]).toContain('exhibit_number,title');
    expect(csv).toContain(`"'=HYPERLINK(""x""), ""quoted"""`);
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('-5')).toBe(`"'-5"`);
  });
});

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926');
  });
  it('writes an archive that unzip can read', () => {
    const zip = createZip(
      [
        { name: 'manifest.json', data: new TextEncoder().encode('{"a":1}') },
        { name: 'exhibits/Exhibit-001.pdf', data: new Uint8Array([1, 2, 3]) },
      ],
      createdAt,
    );
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    const file = join(dir, 'b.zip');
    writeFileSync(file, zip);
    try {
      const listing = execFileSync('unzip', ['-l', file]).toString();
      expect(listing).toContain('exhibits/Exhibit-001.pdf');
      expect(execFileSync('unzip', ['-p', file, 'manifest.json']).toString()).toBe('{"a":1}');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  });
});

describe('limits', () => {
  it('enforces the free tier', () => {
    expect(canCreateCase(false, 0).allowed).toBe(true);
    expect(canCreateCase(false, 1).allowed).toBe(false);
    expect(canCreateCase(true, 50).allowed).toBe(true);
    expect(canAddExhibit(false, 4).allowed).toBe(true);
    expect(canAddExhibit(false, 5).allowed).toBe(false);
    expect(canUse(false, 'packet_export').allowed).toBe(false);
    expect(canUse(true, 'signatures').allowed).toBe(true);
  });
});

describe('search', () => {
  it('quotes terms and prefix-matches the last one', () => {
    expect(toFtsQuery('  lease  agree ')).toBe('"lease" "agree"*');
    expect(toFtsQuery('a"b OR (c*)')).toBe('"ab" "OR" "c"*');
    expect(toFtsQuery('   ')).toBeNull();
  });
});
