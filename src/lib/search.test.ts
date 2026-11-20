import { describe, expect, it } from 'vitest';
import { editDistance, normaliseSearchText, searchScore } from './search';

describe('search helpers', () => {
  it('normalises accents, punctuation and whitespace', () => {
    expect(normaliseSearchText('  Élan—Zitaye!  ')).toBe('elan zitaye');
  });

  it('calculates edit distance', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('music', 'music')).toBe(0);
  });

  it('ranks exact, prefix and substring matches', () => {
    expect(searchScore('pulse', 'Pulse')).toBe(1);
    expect(searchScore('pul', 'Pulse')).toBeGreaterThan(searchScore('pul', 'My Pulse Mix'));
    expect(searchScore('zitaye', 'Eli Njuchi - Zitaye')).toBeGreaterThan(0);
  });

  it('tolerates typos in longer words', () => {
    expect(searchScore('ghetto', 'ghetto')).toBeGreaterThan(searchScore('ghetto', 'ghetxx'));
    expect(searchScore('ghetxo', 'ghetto')).toBeGreaterThan(0);
  });

  it('returns zero for unrelated text', () => {
    expect(searchScore('jazz', 'heavy metal orchestra')).toBe(0);
  });
});
