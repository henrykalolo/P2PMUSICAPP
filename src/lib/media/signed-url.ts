/**
 * Short-lived signed URLs for media playback.
 *
 * Browsers cannot attach Authorization headers to <audio> requests, and range
 * requests must work for seeking. A signed query parameter keeps the media
 * endpoint authorized while remaining compatible with native HTML5 audio.
 */

import { createHmac, timingSafeEqual } from 'crypto';

export const DEFAULT_MEDIA_TOKEN_TTL = 60 * 60; // 1 hour

function getSigningKey(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured (at least 32 characters) to sign media URLs.');
  }
  return createHmac('sha256', secret).update('media-streaming-v1').digest('hex');
}

function sign(trackId: string, expiresAt: number): string {
  return createHmac('sha256', getSigningKey())
    .update(`${trackId}:${expiresAt}`)
    .digest('base64url');
}

/** Returns a relative URL with a short-lived access token. */
export function createMediaUrl(trackId: string, ttlSeconds = DEFAULT_MEDIA_TOKEN_TTL): string {
  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(60, Math.min(ttlSeconds, 24 * 60 * 60));
  const token = sign(trackId, expiresAt);
  return `/api/media/${encodeURIComponent(trackId)}?token=${expiresAt}.${token}`;
}

/**
 * Returns a playable media URL when a track has a server copy or an IPFS CID.
 * Legacy torrent-only posts intentionally get no URL: P2P is never required.
 */
export function createTrackStreamUrl(
  trackId: string,
  storageType: string | null | undefined,
  serverStorageId?: string | null,
  ipfsCid?: string | null
): string | null {
  // Only issue a URL when the media route has bytes it can actually serve.
  if (serverStorageId) return createMediaUrl(trackId);
  if (ipfsCid && (storageType === 'ipfs' || storageType === 'hybrid')) {
    return createMediaUrl(trackId);
  }
  return null;
}

/** Verifies a token issued by createMediaUrl. */
export function verifyMediaToken(trackId: string, token: string | null): boolean {
  if (!token) return false;
  const [expiresRaw, signature] = token.split('.');
  if (!expiresRaw || !signature) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;

  const expected = sign(trackId, expiresAt);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
