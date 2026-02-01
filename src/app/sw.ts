/**
 * Service Worker for P2P Music Platform
 * Handles background seeding, offline caching, and P2P coordination
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(self.clients.claim());
});

// Background sync for seeding
self.addEventListener('sync', (event) => {
  const syncEvent = event as unknown as { tag: string; waitUntil: (promise: Promise<void>) => void };
  if (syncEvent.tag === 'background-seed') {
    syncEvent.waitUntil(handleBackgroundSeeding());
  } else if (syncEvent.tag === 'sync-likes') {
    syncEvent.waitUntil(handleSyncLikes());
  }
});

// Push notifications
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  const data = event.data.json();
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: data.tag,
      data: data.url
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const url = event.notification.data;
  if (url) {
    event.waitUntil(
      self.clients.openWindow(url)
    );
  }
});

// Fetch handler for offline support
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  
  // Handle audio file requests
  if (request.url.match(/\.(mp3|ogg|m4a|flac|wav)$/i)) {
    event.respondWith(handleAudioRequest(request));
  }
});

// Message handler for communication with main thread
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, data } = event.data;

  switch (type) {
    case 'START_SEEDING':
      startBackgroundSeeding(data.infoHash);
      break;
    case 'STOP_SEEDING':
      stopBackgroundSeeding(data.infoHash);
      break;
    case 'CACHE_TRACK':
      cacheTrackForOffline(data.trackId, data.url);
      break;
    case 'GET_SEEDING_STATUS':
      getSeedingStatus().then(status => {
        event.ports[0]?.postMessage({ status });
      });
      break;
    case 'CLEAR_CACHE':
      clearCache();
      break;
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// IndexedDB for storing seeding list and metadata
const DB_NAME = 'P2PMusicPlatform';
const DB_VERSION = 1;

interface SeedingTrack {
  infoHash: string;
  magnetURI: string;
  title: string;
  artist: string;
  addedAt: number;
  priority: number;
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store for seeding list
      if (!db.objectStoreNames.contains('seeding')) {
        const seedingStore = db.createObjectStore('seeding', { keyPath: 'infoHash' });
        seedingStore.createIndex('priority', 'priority', { unique: false });
        seedingStore.createIndex('addedAt', 'addedAt', { unique: false });
      }

      // Store for cached tracks
      if (!db.objectStoreNames.contains('cachedTracks')) {
        const cacheStore = db.createObjectStore('cachedTracks', { keyPath: 'trackId' });
        cacheStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      // Store for pending likes
      if (!db.objectStoreNames.contains('pendingLikes')) {
        db.createObjectStore('pendingLikes', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Audio request handler with offline support
async function handleAudioRequest(request: Request): Promise<Response> {
  const cache = await caches.open('audio-cache-v1');
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Fetch from network and cache
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return offline fallback
    return new Response('Audio not available offline', { status: 503 });
  }
}

// Background seeding management
const activeSeeding = new Set<string>();

async function startBackgroundSeeding(infoHash: string): Promise<void> {
  console.log('[SW] Starting background seeding for:', infoHash);
  activeSeeding.add(infoHash);
  
  // Notify main thread to start seeding
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({
      type: 'START_SEEDING_REQUEST',
      data: { infoHash }
    });
  });
}

async function stopBackgroundSeeding(infoHash: string): Promise<void> {
  console.log('[SW] Stopping background seeding for:', infoHash);
  activeSeeding.delete(infoHash);
  
  // Notify main thread to stop seeding
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({
      type: 'STOP_SEEDING_REQUEST',
      data: { infoHash }
    });
  });
}

async function handleBackgroundSeeding(): Promise<void> {
  console.log('[SW] Handling background sync for seeding...');
  
  try {
    const db = await openDB();
    const transaction = db.transaction('seeding', 'readonly');
    const store = transaction.objectStore('seeding');
    
    const seedingList: SeedingTrack[] = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Resume seeding for all tracked torrents
    for (const track of seedingList) {
      if (!activeSeeding.has(track.infoHash)) {
        await startBackgroundSeeding(track.infoHash);
      }
    }
  } catch (error) {
    console.error('[SW] Background seeding error:', error);
  }
}

async function getSeedingStatus(): Promise<{ infoHash: string; active: boolean }[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction('seeding', 'readonly');
    const store = transaction.objectStore('seeding');
    
    const seedingList: SeedingTrack[] = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return seedingList.map(track => ({
      infoHash: track.infoHash,
      active: activeSeeding.has(track.infoHash)
    }));
  } catch (error) {
    console.error('[SW] Get seeding status error:', error);
    return [];
  }
}

// Offline track caching
async function cacheTrackForOffline(trackId: string, url: string): Promise<void> {
  console.log('[SW] Caching track for offline:', trackId);
  
  try {
    const cache = await caches.open('audio-cache-v1');
    await cache.add(url);
    
    // Store metadata in IndexedDB
    const db = await openDB();
    const transaction = db.transaction('cachedTracks', 'readwrite');
    const store = transaction.objectStore('cachedTracks');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        trackId,
        url,
        cachedAt: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Cache track error:', error);
  }
}

// Sync pending likes when back online
async function handleSyncLikes(): Promise<void> {
  console.log('[SW] Syncing pending likes...');
  
  try {
    const db = await openDB();
    const transaction = db.transaction('pendingLikes', 'readonly');
    const store = transaction.objectStore('pendingLikes');
    
    const pendingLikes = await new Promise<unknown[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const like of pendingLikes) {
      try {
        // Send to server
        const response = await fetch('/api/social/like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(like)
        });
        
        if (response.ok) {
          // Remove from pending
          const deleteTx = db.transaction('pendingLikes', 'readwrite');
          const deleteStore = deleteTx.objectStore('pendingLikes');
          await new Promise<void>((resolve, reject) => {
            const req = deleteStore.delete((like as { id: number }).id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        }
      } catch (error) {
        console.error('[SW] Failed to sync like:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Sync likes error:', error);
  }
}

// Clear all caches
async function clearCache(): Promise<void> {
  console.log('[SW] Clearing all caches...');
  
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  
  // Clear IndexedDB stores
  const db = await openDB();
  const transaction = db.transaction(['seeding', 'cachedTracks'], 'readwrite');
  
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      const req = transaction.objectStore('seeding').clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    }),
    new Promise<void>((resolve, reject) => {
      const req = transaction.objectStore('cachedTracks').clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    })
  ]);
}

export {};
