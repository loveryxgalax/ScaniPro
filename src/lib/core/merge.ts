import { PDFDocument } from 'pdf-lib';

import { createDeterministicDoc, saveDeterministic } from './searchablePdf';
import { toWinAnsi } from './text';

/** Concatenates PDFs in order, preserving each page (and its text layer) as-is. */
export async function mergePdfs(files: Uint8Array[], title: string, createdAt: Date, appVersion: string): Promise<Uint8Array> {
  if (files.length < 2) throw new Error('Choose at least two exhibits to merge.');
  const out = await createDeterministicDoc();
  for (const bytes of files) {
    const src = await PDFDocument.load(bytes, { updateMetadata: false });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  out.setTitle(toWinAnsi(title));
  out.setCreator(`CaseSeal ${appVersion}`);
  out.setProducer(`CaseSeal ${appVersion} (pdf-lib)`);
  out.setCreationDate(createdAt);
  out.setModificationDate(createdAt);
  return saveDeterministic(out);
}
