import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMediaUrl, createTrackStreamUrl, verifyMediaToken } from './signed-url';

const TRACK_ID = '123e4567-e89b-42d3-a456-426614174000';

describe('signed media URLs', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('signs and verifies a URL for one track', () => {
    process.env.JWT_SECRET = 'x'.repeat(64);
    const url = createMediaUrl(TRACK_ID);
    const token = new URL(url, 'http://localhost').searchParams.get('token');
    expect(url).toContain(`/api/media/${TRACK_ID}`);
    expect(verifyMediaToken(TRACK_ID, token)).toBe(true);
  });

  it('rejects a token reused for another track', () => {
    process.env.JWT_SECRET = 'x'.repeat(64);
    const token = new URL(createMediaUrl(TRACK_ID), 'http://localhost').searchParams.get('token');
    expect(verifyMediaToken('999e4567-e89b-42d3-a456-426614174000', token)).toBe(false);
  });

  it('rejects tampered and expired tokens', () => {
    process.env.JWT_SECRET = 'x'.repeat(64);
    const token = new URL(createMediaUrl(TRACK_ID), 'http://localhost').searchParams.get('token');
    expect(verifyMediaToken(TRACK_ID, `${token!.slice(0, -2)}zz`)).toBe(false);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const expiring = createMediaUrl(TRACK_ID, 60);
    const expiringToken = new URL(expiring, 'http://localhost').searchParams.get('token');
    vi.setSystemTime(new Date('2026-01-01T00:02:00Z'));
    expect(verifyMediaToken(TRACK_ID, expiringToken)).toBe(false);
  });

  it('only creates stream URLs for tracks with a playable location', () => {
    process.env.JWT_SECRET = 'x'.repeat(64);

    expect(createTrackStreamUrl(TRACK_ID, 'server', 'storage-id')).toContain('/api/media/');
    expect(createTrackStreamUrl(TRACK_ID, 'hybrid', 'storage-id', 'cid')).toContain('/api/media/');
    expect(createTrackStreamUrl(TRACK_ID, 'ipfs', null, 'cid')).toContain('/api/media/');
    expect(createTrackStreamUrl(TRACK_ID, 'hybrid', null, 'cid')).toContain('/api/media/');

    expect(createTrackStreamUrl(TRACK_ID, 'server', null)).toBeNull();
    expect(createTrackStreamUrl(TRACK_ID, 'hybrid', null, null)).toBeNull();
    expect(createTrackStreamUrl(TRACK_ID, 'ipfs', null, null)).toBeNull();
    expect(createTrackStreamUrl(TRACK_ID, 'torrent', null, null)).toBeNull();

    const token = new URL(
      createTrackStreamUrl(TRACK_ID, 'server', 'storage-id')!,
      'http://localhost'
    ).searchParams.get('token');
    expect(verifyMediaToken(TRACK_ID, token)).toBe(true);
  });
});
