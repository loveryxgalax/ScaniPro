/** Escapes text for XML element content and attributes, dropping characters XML 1.0 forbids. */
export function xmlEscape(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

export const EMU_PER_INCH = 914400;

/** Fits w×h into a box, preserving aspect ratio. */
export function fitInto(w: number, h: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / w, maxH / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}
