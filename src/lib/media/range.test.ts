import { describe, expect, it } from 'vitest';
import { parseRangeHeader } from './range';

describe('parseRangeHeader', () => {
  it('parses explicit and open-ended ranges', () => {
    expect(parseRangeHeader('bytes=0-99', 1000)).toEqual({ start: 0, end: 99, total: 1000 });
    expect(parseRangeHeader('bytes=500-', 1000)).toEqual({ start: 500, end: 999, total: 1000 });
  });

  it('parses suffix ranges', () => {
    expect(parseRangeHeader('bytes=-100', 1000)).toEqual({ start: 900, end: 999, total: 1000 });
    expect(parseRangeHeader('bytes=-5000', 1000)).toEqual({ start: 0, end: 999, total: 1000 });
  });

  it('rejects invalid or unsatisfiable ranges', () => {
    expect(parseRangeHeader(null, 1000)).toBeNull();
    expect(parseRangeHeader('bytes=1000-', 1000)).toBeNull();
    expect(parseRangeHeader('bytes=200-100', 1000)).toBeNull();
    expect(parseRangeHeader('bytes=abc-def', 1000)).toBeNull();
  });
});
