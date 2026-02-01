/**
 * Tiered Cache Implementation for Phase 3
 * Provides multi-level caching: Memory -> IndexedDB -> Service Worker
 * Optimizes P2P content retrieval and reduces redundant downloads
 */

interface CacheTier {
  name: 'memory' | 'indexeddb' | 'service-worker';
  maxSize: number;
  ttl: number;
  priority: number;
}

interface CacheEntry {
  data: Uint8Array;
  timestamp: number;
  accessCount: number;
  size: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
}

const DEFAULT_TIERS: CacheTier[] = [
  { name: 'memory', maxSize: 50 * 1024 * 1024, ttl: 300000, priority: 1 },    // 50MB, 5min
  { name: 'indexeddb', maxSize: 500 * 1024 * 1024, ttl: 86400000, priority: 2 }, // 500MB, 24h
  { name: 'service-worker', maxSize: 2000 * 1024 * 1024, ttl: 604800000, priority: 3 } // 2GB, 7d
];

export class TieredCache {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private db: IDBDatabase | null = null;
  private tiers: CacheTier[];
  private stats: Map<string, CacheStats> = new Map();
  private currentMemorySize = 0;
  private dbName = 'P2PMusicCache';
  private dbVersion = 1;

  constructor(tiers: CacheTier[] = DEFAULT_TIERS) {
    this.tiers = tiers;
    this.initStats();
  }

  /**
   * Initialize the cache system
   */
  async initialize(): Promise<void> {
    await this.initIndexedDB();
    this.startCleanupInterval();
    console.log('[TieredCache] Initialized with tiers:', this.tiers.map(t => t.name).join(', '));
  }

  /**
   * Get a chunk from cache (tries memory -> indexeddb -> service worker)
   */
  async getChunk(infoHash: string, pieceIndex: number): Promise<Uint8Array | null> {
    const key = this.getKey(infoHash, pieceIndex);

    // Try memory cache first (fastest)
    const memChunk = this.getFromMemory(key);
    if (memChunk) {
      this.recordHit('memory');
      return memChunk;
    }

    // Fall through to IndexedDB
    const dbChunk = await this.getFromIndexedDB(key);
    if (dbChunk) {
      // Promote to memory cache
      await this.setInMemory(key, dbChunk);
      this.recordHit('indexeddb');
      return dbChunk;
    }

    // Finally check Service Worker cache
    const swChunk = await this.getFromServiceWorker(key);
    if (swChunk) {
      // Promote up the chain
      await this.setInIndexedDB(key, swChunk);
      await this.setInMemory(key, swChunk);
      this.recordHit('service-worker');
      return swChunk;
    }

    this.recordMiss();
    return null;
  }

  /**
   * Store a chunk in cache (stores in all tiers)
   */
  async setChunk(infoHash: string, pieceIndex: number, data: Uint8Array): Promise<void> {
    const key = this.getKey(infoHash, pieceIndex);

    // Store in memory
    await this.setInMemory(key, data);

    // Store in IndexedDB
    await this.setInIndexedDB(key, data);

    // Store in Service Worker cache (fire and forget)
    this.setInServiceWorker(key, data).catch(err => {
      console.warn('[TieredCache] Service Worker cache error:', err);
    });
  }

  /**
   * Check if a chunk exists in any cache tier
   */
  async hasChunk(infoHash: string, pieceIndex: number): Promise<boolean> {
    const key = this.getKey(infoHash, pieceIndex);

    if (this.memoryCache.has(key)) return true;
    if (await this.hasInIndexedDB(key)) return true;
    if (await this.hasInServiceWorker(key)) return true;

    return false;
  }

  /**
   * Get cache statistics
   */
  getStats(): Record<string, CacheStats> {
    const result: Record<string, CacheStats> = {};
    for (const [tier, stats] of this.stats) {
      result[tier] = { ...stats };
    }
    return result;
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    // Clear memory
    this.memoryCache.clear();
    this.currentMemorySize = 0;

    // Clear IndexedDB
    if (this.db) {
      const transaction = this.db.transaction(['chunks'], 'readwrite');
      const store = transaction.objectStore('chunks');
      await store.clear();
    }

    // Clear Service Worker cache
    if ('caches' in window) {
      const cache = await caches.open('p2p-chunks-v1');
      await cache.keys().then(keys => {
        return Promise.all(keys.map(key => cache.delete(key)));
      });
    }

    console.log('[TieredCache] All caches cleared');
  }

  /**
   * Preload chunks for a torrent
   */
  async preloadChunks(infoHash: string, pieceIndices: number[]): Promise<void> {
    // This would be called by the predictive preloader
    // Implementation depends on integration with WebTorrent
    console.log(`[TieredCache] Preloading ${pieceIndices.length} chunks for ${infoHash}`);
  }

  // Private methods

  private getKey(infoHash: string, pieceIndex: number): string {
    return `${infoHash}:${pieceIndex}`;
  }

  private initStats(): void {
    for (const tier of this.tiers) {
      this.stats.set(tier.name, {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalSize: 0
      });
    }
  }

  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('chunks')) {
          const store = db.createObjectStore('chunks', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        }
      };
    });
  }

  private getFromMemory(key: string): Uint8Array | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    // Check TTL
    const tier = this.tiers.find(t => t.name === 'memory')!;
    if (Date.now() - entry.timestamp > tier.ttl) {
      this.memoryCache.delete(key);
      this.currentMemorySize -= entry.size;
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.timestamp = Date.now();

    return entry.data;
  }

  private async setInMemory(key: string, data: Uint8Array): Promise<void> {
    const tier = this.tiers.find(t => t.name === 'memory')!;

    // Check if we need to evict
    while (this.currentMemorySize + data.length > tier.maxSize && this.memoryCache.size > 0) {
      this.evictFromMemory();
    }

    // Store if there's space
    if (this.currentMemorySize + data.length <= tier.maxSize) {
      this.memoryCache.set(key, {
        data,
        timestamp: Date.now(),
        accessCount: 1,
        size: data.length
      });
      this.currentMemorySize += data.length;
    }
  }

  private evictFromMemory(): void {
    // LRU eviction: remove least recently accessed entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.memoryCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.memoryCache.get(oldestKey)!;
      this.currentMemorySize -= entry.size;
      this.memoryCache.delete(oldestKey);
      this.recordEviction('memory');
    }
  }

  private async getFromIndexedDB(key: string): Promise<Uint8Array | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['chunks'], 'readonly');
      const store = transaction.objectStore('chunks');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Check TTL
        const tier = this.tiers.find(t => t.name === 'indexeddb')!;
        if (Date.now() - result.timestamp > tier.ttl) {
          // Delete expired entry
          this.deleteFromIndexedDB(key);
          resolve(null);
          return;
        }

        // Update access time
        this.updateIndexedDBAccessTime(key);

        resolve(new Uint8Array(result.data));
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async setInIndexedDB(key: string, data: Uint8Array): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['chunks'], 'readwrite');
      const store = transaction.objectStore('chunks');

      const request = store.put({
        key,
        data: data.buffer,
        timestamp: Date.now(),
        size: data.length
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async hasInIndexedDB(key: string): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['chunks'], 'readonly');
      const store = transaction.objectStore('chunks');
      const request = store.count(key);

      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['chunks'], 'readwrite');
      const store = transaction.objectStore('chunks');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async updateIndexedDBAccessTime(key: string): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['chunks'], 'readwrite');
    const store = transaction.objectStore('chunks');
    const request = store.get(key);

    request.onsuccess = () => {
      const data = request.result;
      if (data) {
        data.timestamp = Date.now();
        data.accessCount = (data.accessCount || 0) + 1;
        store.put(data);
      }
    };
  }

  private async getFromServiceWorker(key: string): Promise<Uint8Array | null> {
    if (!('caches' in window)) return null;

    try {
      const cache = await caches.open('p2p-chunks-v1');
      const response = await cache.match(`/cache/${key}`);

      if (!response) return null;

      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (err) {
      console.warn('[TieredCache] Service Worker cache read error:', err);
      return null;
    }
  }

  private async setInServiceWorker(key: string, data: Uint8Array): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cache = await caches.open('p2p-chunks-v1');
      // Convert Uint8Array to Blob for Response constructor
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const response = new Response(blob, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Cache-Timestamp': Date.now().toString()
        }
      });
      await cache.put(`/cache/${key}`, response);
    } catch (err) {
      console.warn('[TieredCache] Service Worker cache write error:', err);
    }
  }

  private async hasInServiceWorker(key: string): Promise<boolean> {
    if (!('caches' in window)) return false;

    try {
      const cache = await caches.open('p2p-chunks-v1');
      const response = await cache.match(`/cache/${key}`);
      return response !== undefined;
    } catch {
      return false;
    }
  }

  private startCleanupInterval(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 300000);
  }

  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();

    // Clean memory cache
    for (const [key, entry] of this.memoryCache) {
      const tier = this.tiers.find(t => t.name === 'memory')!;
      if (now - entry.timestamp > tier.ttl) {
        this.currentMemorySize -= entry.size;
        this.memoryCache.delete(key);
      }
    }

    // Clean IndexedDB (this is more expensive, do it less frequently)
    if (this.db && Math.random() < 0.1) { // 10% chance each cleanup
      const transaction = this.db.transaction(['chunks'], 'readonly');
      const store = transaction.objectStore('chunks');
      const index = store.index('timestamp');
      const request = index.openCursor();

      const toDelete: string[] = [];
      const tier = this.tiers.find(t => t.name === 'indexeddb')!;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          if (now - cursor.value.timestamp > tier.ttl) {
            toDelete.push(cursor.value.key);
          }
          cursor.continue();
        } else {
          // Delete expired entries
          toDelete.forEach(key => this.deleteFromIndexedDB(key));
        }
      };
    }
  }

  private recordHit(tier: string): void {
    const stats = this.stats.get(tier)!;
    stats.hits++;
  }

  private recordMiss(): void {
    // Record miss in all tiers
    for (const stats of this.stats.values()) {
      stats.misses++;
    }
  }

  private recordEviction(tier: string): void {
    const stats = this.stats.get(tier)!;
    stats.evictions++;
  }
}

// Singleton instance
let globalCache: TieredCache | null = null;

export function getGlobalCache(): TieredCache {
  if (!globalCache) {
    globalCache = new TieredCache();
  }
  return globalCache;
}

export async function initializeGlobalCache(): Promise<void> {
  const cache = getGlobalCache();
  await cache.initialize();
}
