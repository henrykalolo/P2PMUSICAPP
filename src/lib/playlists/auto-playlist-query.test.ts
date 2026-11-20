import { describe, expect, it } from 'vitest';
import {
  buildAutoPlaylistFallbackQuery,
  buildAutoPlaylistQuery,
} from './auto-playlist-query';

const VIEWER = '11111111-1111-4111-8111-111111111111';
const FOLLOWED = '22222222-2222-4222-8222-222222222222';

describe('personalized mix query', () => {
  it('treats genres and followed artists as alternatives', () => {
    const { sql, params } = buildAutoPlaylistQuery({
      viewerId: VIEWER,
      preferences: ['jazz', 'soul'],
      followingIds: [FOLLOWED],
      limit: 30,
      randomize: true,
    });

    expect(sql).toContain('$2::text[]');
    expect(sql).toContain('$3::uuid[]');
    expect(sql).toContain(' OR ');
    expect(sql).not.toContain('p.genre = ANY($2) AND p.author_id');
    expect(params[0]).toBe(VIEWER);
    expect(params[1]).toEqual(['jazz', 'soul']);
    expect(params[2]).toEqual([FOLLOWED]);
    expect(params[3]).toBe(30);
  });

  it('omits the interest clause when there are no preferences or follows', () => {
    const { sql, params } = buildAutoPlaylistQuery({
      viewerId: VIEWER,
      preferences: [],
      followingIds: [],
      limit: 20,
      randomize: false,
    });

    expect(sql).not.toContain('ANY(');
    expect(sql).toContain('ORDER BY COUNT(DISTINCT l.user_id) DESC');
    expect(params).toEqual([VIEWER, 20]);
  });

  it('clamps the limit and can include the viewer when requested', () => {
    const { sql, params } = buildAutoPlaylistQuery({
      viewerId: VIEWER,
      preferences: [],
      followingIds: [],
      limit: 999,
      randomize: true,
      includeOwn: true,
    });

    expect(sql).not.toContain('p.author_id !=');
    expect(params).toEqual([50]);
  });

  it('builds a popular-tracks fallback that excludes the viewer', () => {
    const { sql, params } = buildAutoPlaylistFallbackQuery(VIEWER, 10);
    expect(sql).toContain('p.author_id != $1');
    expect(sql).toContain('LIMIT $2');
    expect(params).toEqual([VIEWER, 10]);
  });
});
