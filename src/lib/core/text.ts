/** Characters Helvetica/Courier (WinAnsi) can encode, besides printable ASCII. */
const WIN_ANSI_EXTRA = new Set(
  Array.from('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ'),
);

/**
 * Makes a string safe for the PDF standard fonts. Unsupported characters are
 * replaced so that drawing never throws on user-entered titles or OCR output.
 */
export function toWinAnsi(input: string): string {
  let out = '';
  for (const ch of input.normalize('NFC')) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '\t') out += ' ';
    else if (code >= 0x20 && code <= 0x7e) out += ch;
    else if (WIN_ANSI_EXTRA.has(ch)) out += ch;
    else if (code === 0xa0) out += ' ';
    else if (ch === '’' || ch === '‘') out += "'";
    else if (code < 0x20) continue;
    else out += '?';
  }
  return out;
}

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : `${input.slice(0, Math.max(0, max - 1))}…`;
}

export function shortHash(hash: string, size = 8): string {
  return hash.length <= size * 2 ? hash : `${hash.slice(0, size)}…${hash.slice(-size)}`;
}

export function padExhibitNumber(n: number): string {
  return String(n).padStart(3, '0');
}

/** Filesystem-safe slug for exported file names. */
export function safeFileName(input: string, fallback = 'file'): string {
  const cleaned = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._ -]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return cleaned || fallback;
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += (bytes[i] as number).toString(16).padStart(2, '0');
  return hex;
}

export function utf8(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
