import { verifyChain } from '../core/custody';
import { buildManifest, manifestToCsv, type ManifestExhibit } from '../core/manifest';
import { buildPacketPdf, type PacketExhibit } from '../core/packetPdf';
import { safeFileName, utf8 } from '../core/text';
import { createZip } from '../core/zip';
import { getDb } from '../db';
import { appendCustody, listCustody, rowToEntry } from '../db/custody';
import { getCase, listExhibits, listPages, listVersions, listWithdrawnNumbers } from '../db/queries';
import { notifyDataChanged } from '../events';
import { deviceContext } from '../platform/device';
import { readBytes } from '../platform/files';
import { sha256 } from '../platform/hash';
import { exhibitFileName, versionLabel } from './exhibits';
import { saveExport, shareExport, type ExportedFile } from './share';

export { shareExport, type ExportedFile };

export type PacketOptions = { useLatestVersions: boolean; embedExhibitFiles: boolean };

export type PacketExport = {
  packet: ExportedFile;
  manifestJson: ExportedFile;
  manifestCsv: ExportedFile;
  bundle: ExportedFile;
  pageCount: number;
  exhibitCount: number;
};

function stamp(d: Date) {
  return d.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
}

export async function exportPacket(
  caseId: string,
  options: PacketOptions,
  onProgress?: (message: string) => void,
): Promise<PacketExport> {
  const db = await getDb();
  const c = await getCase(db, caseId);
  if (!c) throw new Error('Case not found.');
  const exhibits = await listExhibits(db, caseId);
  if (!exhibits.length) throw new Error('Add at least one exhibit before exporting.');
  const pending = exhibits.filter((e) => !e.current_version_id);
  if (pending.length) {
    throw new Error(`Exhibit ${pending.map((e) => e.number).join(', ')} is still being processed. Try again in a moment.`);
  }
  const device = deviceContext();
  const generatedAt = new Date();

  const packetExhibits: PacketExhibit[] = [];
  const manifestExhibits: ManifestExhibit[] = [];
  for (const ex of exhibits) {
    onProgress?.(`Verifying Exhibit ${ex.number}…`);
    const versions = await listVersions(db, ex.id);
    const chosen = options.useLatestVersions
      ? versions.find((v) => v.id === ex.current_version_id)
      : versions.find((v) => v.version === 1);
    if (!chosen) throw new Error(`Exhibit ${ex.number} has no PDF yet.`);
    const pdf = await readBytes(chosen.file_path);
    const hash = await sha256(pdf);
    if (hash !== chosen.sha256) {
      throw new Error(`Exhibit ${ex.number} failed its integrity check, so the packet was not created. Open it and run Verify Integrity.`);
    }
    const custodyRows = await listCustody(db, ex.id);
    const chain = await verifyChain(custodyRows.map(rowToEntry), sha256);
    const pages = await listPages(db, ex.id);
    const fileName = exhibitFileName(ex, chosen);
    packetExhibits.push({
      number: ex.number,
      title: ex.title,
      capturedAt: ex.captured_at,
      versionLabel: versionLabel(chosen),
      fileName,
      pdf,
      sha256: hash,
      captureDigest: ex.capture_digest,
    });
    const byId = new Map(versions.map((v) => [v.id, v]));
    manifestExhibits.push({
      number: ex.number,
      exhibitId: ex.id,
      title: ex.title,
      capturedAt: ex.captured_at,
      captureDigest: ex.capture_digest,
      pages: pages.map((p) => ({ index: p.page_index + 1, sha256: p.sha256, width: p.width, height: p.height })),
      file: { name: fileName, version: chosen.version, kind: chosen.kind, sha256: hash, bytes: pdf.length },
      versions: versions.map((v) => ({
        version: v.version,
        kind: v.kind,
        sha256: v.sha256,
        parentSha256: v.parent_version_id ? (byId.get(v.parent_version_id)?.sha256 ?? null) : null,
        createdAt: v.created_at,
        description: v.description,
      })),
      custody: custodyRows.map((r) => ({
        seq: r.seq,
        timestamp: r.timestamp,
        action: r.action,
        fileSha256: r.file_sha256,
        entryHash: r.entry_hash,
      })),
      custodyChainValid: chain.ok,
    });
  }

  const withdrawn = await listWithdrawnNumbers(db, caseId);
  onProgress?.('Building packet PDF…');
  const result = await buildPacketPdf({
    caseTitle: c.title,
    caseReference: c.reference,
    matterDate: c.matter_date,
    generatedAt,
    device,
    exhibits: packetExhibits,
    withdrawn,
    embedExhibitFiles: options.embedExhibitFiles,
  });

  const base = `EvidencePacket_${safeFileName(c.reference || c.title, 'Case')}_${stamp(generatedAt)}`;
  onProgress?.('Hashing and writing files…');
  const packet = await saveExport(`${base}.pdf`, result.pdf, 'pdf');
  const manifest = buildManifest({
    generatedAt,
    device,
    caseInfo: { id: c.id, title: c.title, reference: c.reference, matterDate: c.matter_date },
    packet: {
      fileName: packet.name,
      sha256: packet.sha256,
      bytes: packet.bytes,
      pageCount: result.pageCount,
      exhibitFilesEmbedded: options.embedExhibitFiles,
    },
    exhibits: manifestExhibits,
    ranges: result.exhibitPages,
    withdrawn,
  });
  const jsonBytes = utf8(`${JSON.stringify(manifest, null, 2)}\n`);
  const csvBytes = utf8(manifestToCsv(manifest));
  const manifestJson = await saveExport(`${base}_manifest.json`, jsonBytes, 'json');
  const manifestCsv = await saveExport(`${base}_manifest.csv`, csvBytes, 'csv');

  const readme = [
    'ScaniPro evidence bundle',
    '',
    `Case: ${c.title}${c.reference ? ` (Ref. ${c.reference})` : ''}`,
    `Generated (UTC): ${generatedAt.toISOString()}`,
    `Device: ${device.deviceModel}, ${device.osName} ${device.osVersion}; ScaniPro ${device.appVersion} (${device.appBuild})`,
    '',
    'Contents',
    `  ${packet.name}  SHA-256 ${packet.sha256}`,
    `  ${manifestJson.name}`,
    `  ${manifestCsv.name}`,
    ...packetExhibits.map((e) => `  exhibits/${e.fileName}  SHA-256 ${e.sha256}`),
    '',
    'To verify a file, compute its SHA-256 and compare it with the value above and in the manifest:',
    '  macOS/Linux: shasum -a 256 <file>',
    '  Windows:     certutil -hashfile <file> SHA256',
    '',
    'All capture, OCR, hashing and export happened on the device listed above. Nothing was uploaded.',
    '',
  ].join('\r\n');
  const zip = createZip(
    [
      { name: packet.name, data: result.pdf },
      { name: manifestJson.name, data: jsonBytes },
      { name: manifestCsv.name, data: csvBytes },
      { name: 'README.txt', data: utf8(readme) },
      ...packetExhibits.map((e) => ({ name: `exhibits/${e.fileName}`, data: e.pdf })),
    ],
    generatedAt,
  );
  const bundle = await saveExport(`${base}.zip`, zip, 'zip');

  onProgress?.('Recording custody entries…');
  for (const ex of exhibits) {
    const pe = packetExhibits.find((p) => p.number === ex.number);
    const range = result.exhibitPages.find((r) => r.number === ex.number);
    if (!pe) continue;
    await db.withExclusiveTransactionAsync(async (tx) => {
      await appendCustody(tx, {
        exhibitId: ex.id,
        caseId,
        action: 'exported',
        fileSha256: pe.sha256,
        timestamp: generatedAt.toISOString(),
        details: {
          packetFile: packet.name,
          packetSha256: packet.sha256,
          packetPages: range ? `${range.start}-${range.end}` : null,
          bundleSha256: bundle.sha256,
          version: pe.versionLabel,
        },
      });
    });
  }
  notifyDataChanged();

  return {
    packet,
    manifestJson,
    manifestCsv,
    bundle,
    pageCount: result.pageCount,
    exhibitCount: exhibits.length,
  };
}
