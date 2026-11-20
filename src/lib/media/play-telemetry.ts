export type PlayEventType = 'play' | 'complete' | 'skip';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function playbackTokenFromUrl(mediaUrl?: string | null): string | null {
  if (!mediaUrl) return null;
  try {
    const url = new URL(mediaUrl, window.location.origin);
    if (url.pathname.startsWith('/api/media/')) {
      return url.searchParams.get('token');
    }
  } catch {
    // Ignore malformed sources; authenticated listeners still report normally.
  }
  return null;
}

/**
 * Best-effort playback telemetry; never throws or interrupts playback.
 * Authenticated listeners use their JWT; public signed playback URLs carry a
 * track-scoped token so anonymous listens can still be counted.
 */
export function reportPlayEvent(
  eventType: PlayEventType,
  trackId: string,
  progressSeconds: number,
  durationSeconds: number,
  mediaUrl?: string | null
): void {
  if (typeof window === 'undefined' || !UUID_RE.test(trackId)) return;

  const token = window.localStorage.getItem('token');
  const playbackToken = playbackTokenFromUrl(mediaUrl);
  if (!token && !playbackToken) return;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  void fetch(`/api/tracks/${encodeURIComponent(trackId)}/play`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      eventType,
      eventId: createEventId(),
      progressSeconds: Math.max(0, Math.floor(progressSeconds || 0)),
      durationSeconds: Math.max(0, Math.floor(durationSeconds || 0)),
      ...(playbackToken ? { playbackToken } : {}),
    }),
  }).catch(() => {
    // Telemetry must never interrupt playback.
  });
}
