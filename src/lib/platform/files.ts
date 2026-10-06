import { Directory, File, Paths } from 'expo-file-system';

/**
 * All evidence lives under Documents/ScaniPro. Paths are stored relative to
 * Documents because iOS changes the container path between app updates.
 */
const ROOT = 'ScaniPro';

export function toAbsolute(relPath: string): File {
  return new File(Paths.document, ROOT, relPath);
}

export function exhibitDir(caseId: string, exhibitId: string) {
  return `cases/${caseId}/exhibits/${exhibitId}`;
}

export function ensureDir(relDir: string) {
  const dir = new Directory(Paths.document, ROOT, relDir);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function writeBytes(relPath: string, bytes: Uint8Array) {
  const parts = relPath.split('/');
  parts.pop();
  ensureDir(parts.join('/'));
  const file = toAbsolute(relPath);
  if (file.exists) throw new Error(`Refusing to overwrite evidence file ${relPath}`);
  file.create();
  file.write(bytes);
  return file;
}

export async function readBytes(relPath: string): Promise<Uint8Array> {
  return toAbsolute(relPath).bytes();
}

export function deleteTree(relDir: string) {
  const dir = new Directory(Paths.document, ROOT, relDir);
  if (dir.exists) dir.delete();
}

export function storageUsedBytes(): number {
  const dir = new Directory(Paths.document, ROOT);
  return dir.exists ? (dir.size ?? 0) : 0;
}

/** Scratch space for exports; cleared on demand and safe to lose. */
export function exportFile(name: string): File {
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, name);
  if (file.exists) file.delete();
  file.create();
  return file;
}

export function clearExports() {
  const dir = new Directory(Paths.cache, 'exports');
  if (dir.exists) dir.delete();
}

export function readExternal(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

export function deleteExternal(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Scanner temp files are best-effort cleanup.
  }
}
