/**
 * Tiered Cache System for P2P Music Platform
 * Multi-tier caching to minimize redundant P2P downloads and improve playback latency
 */

export interface CacheTier {
  name: 'memory' | 'indexeddb' | 'service-worker';
  maxSize: number;
  ttl: number;
  priority: number;
}

export interface CacheEntry {
  data: Uint8Array;
  timestamp: number;
  size: number;
  accessCount: number;
  lastAccessed: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private currentSize = 0;
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  async get(key: string): Promise<Uint8Array | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (this.isExpired(entry)) {
      this.remove(key);
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  async set(key: string, data: Uint8Array): Promise<void> {
    const size = data.length;

    // Evict if necessary
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }

    if (this.currentSize + size <= this.maxSize) {
      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
        size,
        accessCount: 1,
        lastAccessed: Date.now(),
      };
      this.cache.set(key, entry);
      this.currentSize += size;
    }
  }

  async delete(key: string): Promise<void> {
    this.remove(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.currentSize = 0;
  }

  private remove(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.cache.delete(key);
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    const ttl = 5 * 60 * 1000; // 5 minutes for memory cache
    return Date.now() - entry.timestamp > ttl;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.remove(oldestKey);
    }
  }
}

class IndexedDBCache {
  private dbName = 'P2PMusicCache';
  private storeName = 'chunks';
  private maxSize: number;
  private currentSize = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(key: string): Promise<Uint8Array | null> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result;
        if (!entry) {
          resolve(null);
          return;
        }

        // Check TTL
        const ttl = 24 * 60 * 60 * 1000; // 24 hours
        if (Date.now() - entry.timestamp > ttl) {
          this.delete(key);
          resolve(null);
          return;
        }

        // Update access info
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        const updateTransaction = db.transaction(this.storeName, 'readwrite');
        const updateStore = updateTransaction.objectStore(this.storeName);
        updateStore.put(entry);

        resolve(new Uint8Array(entry.data));
      };

      request.onerror = () => reject(request.error);
    });
  }

  async set(key: string, data: Uint8Array): Promise<void> {
    const db = await this.openDB();

    // Check current size and evict if needed
    await this.evictIfNeeded(data.length);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const entry = {
        key,
        data: Array.from(data),
        timestamp: Date.now(),
        size: data.length,
        accessCount: 1,
        lastAccessed: Date.now(),
      };

      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async evictIfNeeded(newDataSize: number): Promise<void> {
    // Simple eviction - clear old entries if approaching limit
    const db = await this.openDB();

    return new Promise((resolve) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('lastAccessed');
      const request = index.openCursor(null, 'prev'); // Newest first

      request.onsuccess = () => {
        // Simplified - just resolve for now
        resolve();
      };
      request.onerror = () => resolve();
    });
  }
}

class ServiceWorkerCache {
  private cacheName = 'p2p-audio-cache-v1';
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  async get(key: string): Promise<Uint8Array | null> {
    if (typeof caches === 'undefined') return null;

    try {
      const cache = await caches.open(this.cacheName);
      const response = await cache.match(new Request(`/cache/${key}`));

      if (!response) return null;

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch {
      return null;
    }
  }

  async set(key: string, data: Uint8Array): Promise<void> {
    if (typeof caches === 'undefined') return;

    try {
      const cache = await caches.open(this.cacheName);
      const response = new Response(data as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'max-age=604800', // 7 days
        },
      });

      await cache.put(new Request(`/cache/${key}`), response);
    } catch (error) {
      console.error('Service Worker cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    if (typeof caches === 'undefined') return;

    try {
      const cache = await caches.open(this.cacheName);
      await cache.delete(new Request(`/cache/${key}`));
    } catch (error) {
      console.error('Service Worker cache delete error:', error);
    }
  }

  async clear(): Promise<void> {
    if (typeof caches === 'undefined') return;

    try {
      await caches.delete(this.cacheName);
    } catch (error) {
      console.error('Service Worker cache clear error:', error);
    }
  }
}

export class TieredCache {
  private tiers: CacheTier[] = [
    { name: 'memory', maxSize: 50 * 1024 * 1024, ttl: 300000, priority: 1 },
    { name: 'indexeddb', maxSize: 500 * 1024 * 1024, ttl: 86400000, priority: 2 },
    { name: 'service-worker', maxSize: 2000 * 1024 * 1024, ttl: 604800000, priority: 3 },
  ];

  private memoryCache: MemoryCache;
  private indexedDBCache: IndexedDBCache;
  private serviceWorkerCache: ServiceWorkerCache;

  constructor() {
    this.memoryCache = new MemoryCache(this.tiers[0].maxSize);
    this.indexedDBCache = new IndexedDBCache(this.tiers[1].maxSize);
    this.serviceWorkerCache = new ServiceWorkerCache(this.tiers[2].maxSize);
  }

  /**
   * Get chunk from cache, trying each tier in priority order
   */
  async getChunk(infoHash: string, pieceIndex: number): Promise<Uint8Array | null> {
    const key = `${infoHash}:${pieceIndex}`;

    // Try memory first (fastest)
    const memChunk = await this.memoryCache.get(key);
    if (memChunk) {
      return memChunk;
    }

    // Fall through to IndexedDB
    const dbChunk = await this.indexedDBCache.get(key);
    if (dbChunk) {
      // Promote to memory cache
      await this.memoryCache.set(key, dbChunk);
      return dbChunk;
    }

    // Finally check Service Worker cache
    const swChunk = await this.serviceWorkerCache.get(key);
    if (swChunk) {
      // Promote up the chain
      await this.indexedDBCache.set(key, swChunk);
      await this.memoryCache.set(key, swChunk);
      return swChunk;
    }

    return null;
  }

  /**
   * Store chunk in all cache tiers
   */
  async setChunk(infoHash: string, pieceIndex: number, data: Uint8Array): Promise<void> {
    const key = `${infoHash}:${pieceIndex}`;

    // Store in all tiers
    await Promise.all([
      this.memoryCache.set(key, data),
      this.indexedDBCache.set(key, data),
      this.serviceWorkerCache.set(key, data),
    ]);
  }

  /**
   * Remove chunk from all cache tiers
   */
  async invalidateChunk(infoHash: string, pieceIndex: number): Promise<void> {
    const key = `${infoHash}:${pieceIndex}`;

    await Promise.all([
      this.memoryCache.delete(key),
      this.indexedDBCache.delete(key),
      this.serviceWorkerCache.delete(key),
    ]);
  }

  /**
   * Clear all cache tiers
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      this.memoryCache.clear(),
      this.indexedDBCache.clear(),
      this.serviceWorkerCache.clear(),
    ]);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memory: { size: number; entries: number };
    indexedDB: { size: number; entries: number };
    serviceWorker: { size: number; entries: number };
  }> {
    return {
      memory: { size: 0, entries: 0 }, // Simplified for now
      indexedDB: { size: 0, entries: 0 },
      serviceWorker: { size: 0, entries: 0 },
    };
  }
}

// Export singleton instance
export const tieredCache = new TieredCache();
