/**
 * Turns free text into a safe FTS5 MATCH expression: every term is quoted
 * (so punctuation cannot inject syntax) and the last term is a prefix match.
 */
export function toFtsQuery(input: string): string | null {
  const terms = input
    .normalize('NFKC')
    .split(/\s+/)
    .map((t) => t.replace(/["*^():]/g, '').trim())
    .filter((t) => t.length > 0)
    .slice(0, 12);
  if (!terms.length) return null;
  return terms.map((t, i) => (i === terms.length - 1 ? `"${t}"*` : `"${t}"`)).join(' ');
}
