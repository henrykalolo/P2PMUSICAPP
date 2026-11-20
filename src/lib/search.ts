/**
 * Lightweight typo-tolerant matching used by /api/search.
 * It is intentionally dependency-free and deterministic so the same ranking
 * can be tested and reused on the client.
 */

export function normaliseSearchText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;
  if (Math.abs(left.length - right.length) > 3) return 99;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[right.length];
}

/** Returns 0..1, where 1 is an exact match. */
export function searchScore(query: string, text: string): number {
  const q = normaliseSearchText(query);
  const t = normaliseSearchText(text);
  if (!q || !t) return 0;
  if (t === q) return 1;
  if (t.startsWith(q)) return 0.92;
  if (t.includes(q)) return 0.82;

  const queryWords = q.split(' ').filter(Boolean);
  const textWords = new Set(t.split(' ').filter(Boolean));
  const matchedWords = queryWords.filter((word) => {
    if (textWords.has(word)) return true;
    const tolerance = word.length >= 6 ? 2 : 1;
    return Array.from(textWords).some(
      (candidate) => Math.abs(candidate.length - word.length) <= tolerance &&
        editDistance(word, candidate) <= tolerance
    );
  });
  if (matchedWords.length > 0) {
    return 0.55 + 0.3 * (matchedWords.length / queryWords.length);
  }

  const tolerance = q.length >= 7 ? 2 : 1;
  const distance = editDistance(q, t);
  if (distance <= tolerance) return 0.5 - distance * 0.1;
  return 0;
}

export function combineSearchScore(query: string, fields: string[]): number {
  return fields.reduce((best, field) => Math.max(best, searchScore(query, field)), 0);
}
