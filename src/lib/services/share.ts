import * as Sharing from 'expo-sharing';

import { exportFile } from '../platform/files';
import { sha256 } from '../platform/hash';

export type ExportedFile = { name: string; uri: string; sha256: string; bytes: number; mimeType: string; uti: string };

export const MIME = {
  pdf: ['application/pdf', 'com.adobe.pdf'],
  zip: ['application/zip', 'public.zip-archive'],
  json: ['application/json', 'public.json'],
  csv: ['text/csv', 'public.comma-separated-values-text'],
  txt: ['text/plain', 'public.plain-text'],
  jpeg: ['image/jpeg', 'public.jpeg'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'org.openxmlformats.wordprocessingml.document'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'org.openxmlformats.presentationml.presentation'],
} as const;

export async function saveExport(name: string, bytes: Uint8Array, kind: keyof typeof MIME): Promise<ExportedFile> {
  const f = exportFile(name);
  f.write(bytes);
  const [mimeType, uti] = MIME[kind];
  return { name, uri: f.uri, sha256: await sha256(bytes), bytes: bytes.length, mimeType, uti };
}

export async function shareExport(file: ExportedFile) {
  await Sharing.shareAsync(file.uri, { mimeType: file.mimeType, UTI: file.uti, dialogTitle: file.name });
}
