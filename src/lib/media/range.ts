export interface MediaRange {
  start: number;
  end: number; // inclusive
  total: number;
}

/** Parse a single Range header. Returns null when the full body should be sent. */
export function parseRangeHeader(header: string | null, total: number): MediaRange | null {
  if (!header || total <= 0) return null;
  const match = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const [, startRaw, endRaw] = match;
  let start: number;
  let end: number;

  if (startRaw === '' && endRaw !== '') {
    const suffix = Number(endRaw);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(startRaw);
    end = endRaw === '' ? total - 1 : Number(endRaw);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null;
    if (start >= total || start > end) return null;
    end = Math.min(end, total - 1);
  }

  return { start, end, total };
}
