/**
 * Service worker for optional offline playback.
 *
 * Background seeding from a browser tab is not reliable and is not implemented.
 * This worker only caches media that the app explicitly asks it to cache.
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'media-offline-v1';
const DB_NAME = 'P2PMusicPlatform';
const DB_VERSION = 2;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  const data = event.data.json() as { title?: string; body?: string; tag?: string; url?: string };
  event.waitUntil(
    self.registration.showNotification(data.title || 'P2P Music', {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: data.tag,
      data: data.url,
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification.data as string | undefined;
  if (url) {
    event.waitUntil(self.clients.openWindow(url));
  }
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);
  // Only explicitly cached media is served offline.
  if (request.method === 'GET' && url.origin === self.location.origin && url.pathname.startsWith('/api/media/')) {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
  }
  return response;
}

interface CachedTrack {
  trackId: string;
  url: string;
  cachedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (db.objectStoreNames.contains('seeding')) db.deleteObjectStore('seeding');
      if (!db.objectStoreNames.contains('cachedTracks')) {
        db.createObjectStore('cachedTracks', { keyPath: 'trackId' });
      }
    };
  });
}

async function cacheTrackForOffline(trackId: string, url: string): Promise<void> {
  const parsed = new URL(url, self.location.origin);
  if (parsed.origin !== self.location.origin || !parsed.pathname.startsWith('/api/media/')) {
    throw new Error('Only local media URLs can be cached');
  }

  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(parsed.toString());
  if (!response.ok) throw new Error('Unable to cache this track');
  await cache.put(parsed.toString(), response);

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('cachedTracks', 'readwrite');
    const request = tx.objectStore('cachedTracks').put({
      trackId,
      url: parsed.toString(),
      cachedAt: Date.now(),
    } satisfies CachedTrack);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clearCache(): Promise<void> {
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('cachedTracks', 'readwrite');
    const request = tx.objectStore('cachedTracks').clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string; data?: { trackId?: string; url?: string } } | undefined;
  const port = event.ports[0];

  const respond = (value: unknown) => port?.postMessage(value);

  (async () => {
    switch (data?.type) {
      case 'CACHE_TRACK':
        await cacheTrackForOffline(String(data.data?.trackId), String(data.data?.url));
        respond({ success: true });
        break;
      case 'CLEAR_CACHE':
        await clearCache();
        respond({ success: true });
        break;
      // Kept for older callers; seeding is intentionally not supported.
      case 'GET_SEEDING_STATUS':
        respond({ status: [] });
        break;
      default:
        respond({ success: false, error: 'Unknown message type' });
    }
  })().catch((error: unknown) => {
    respond({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  });
});

export {};
