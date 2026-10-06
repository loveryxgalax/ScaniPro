import type { PacketPageRange } from './packetPdf';
import type { DeviceContext } from './types';

export const MANIFEST_SCHEMA = 'caseseal.evidence-manifest/v1';

export type ManifestExhibit = {
  number: number;
  exhibitId: string;
  title: string;
  capturedAt: string;
  captureDigest: string;
  pages: { index: number; sha256: string; width: number; height: number }[];
  file: { name: string; version: number; kind: string; sha256: string; bytes: number };
  versions: { version: number; kind: string; sha256: string; parentSha256: string | null; createdAt: string; description: string }[];
  custody: { seq: number; timestamp: string; action: string; fileSha256: string; entryHash: string }[];
  custodyChainValid: boolean;
};

export type Manifest = {
  schema: typeof MANIFEST_SCHEMA;
  generatedAt: string;
  generator: DeviceContext & { app: 'CaseSeal' };
  case: { id: string; title: string; reference: string | null; matterDate: string | null };
  packet: { fileName: string; sha256: string; bytes: number; pageCount: number; exhibitFilesEmbedded: boolean };
  exhibits: (ManifestExhibit & { packetPages: { start: number; end: number } | null })[];
  withdrawnExhibitNumbers: number[];
  notes: string;
};

export function buildManifest(args: {
  generatedAt: Date;
  device: DeviceContext;
  caseInfo: Manifest['case'];
  packet: Manifest['packet'];
  exhibits: ManifestExhibit[];
  ranges: PacketPageRange[];
  withdrawn: number[];
}): Manifest {
  return {
    schema: MANIFEST_SCHEMA,
    generatedAt: args.generatedAt.toISOString(),
    generator: { app: 'CaseSeal', ...args.device },
    case: args.caseInfo,
    packet: args.packet,
    exhibits: [...args.exhibits]
      .sort((a, b) => a.number - b.number)
      .map((ex) => {
        const r = args.ranges.find((x) => x.number === ex.number);
        return { ...ex, packetPages: r ? { start: r.start, end: r.end } : null };
      }),
    withdrawnExhibitNumbers: [...args.withdrawn].sort((a, b) => a - b),
    notes:
      'All hashes are SHA-256, hex encoded. captureDigest = SHA-256 of "caseseal-capture-v1\\n" followed by the ' +
      'page sha256 values joined with "\\n". Custody entries are hash-chained: each entryHash commits to the ' +
      'previous entry. Generated entirely on-device; nothing was uploaded.',
  };
}

export function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const CSV_HEADER = [
  'exhibit_number',
  'title',
  'captured_at_utc',
  'page_count',
  'version',
  'version_kind',
  'file_name',
  'file_sha256',
  'file_bytes',
  'capture_digest',
  'packet_page_start',
  'packet_page_end',
  'custody_entries',
  'custody_chain_valid',
] as const;

export function manifestToCsv(m: Manifest): string {
  const rows: string[] = [CSV_HEADER.join(',')];
  for (const ex of m.exhibits) {
    rows.push(
      [
        ex.number,
        ex.title,
        ex.capturedAt,
        ex.pages.length,
        ex.file.version,
        ex.file.kind,
        ex.file.name,
        ex.file.sha256,
        ex.file.bytes,
        ex.captureDigest,
        ex.packetPages?.start ?? '',
        ex.packetPages?.end ?? '',
        ex.custody.length,
        ex.custodyChainValid ? 'yes' : 'NO',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  rows.push('');
  rows.push(['packet_file', 'packet_sha256', 'packet_bytes', 'packet_pages', 'generated_at_utc'].join(','));
  rows.push(
    [m.packet.fileName, m.packet.sha256, m.packet.bytes, m.packet.pageCount, m.generatedAt].map(csvCell).join(','),
  );
  return `${rows.join('\r\n')}\r\n`;
}
