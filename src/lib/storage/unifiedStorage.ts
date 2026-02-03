/**
 * Unified Storage System with Fallback Mechanism
 * Provides a single interface for multiple storage backends with automatic fallback
 * and IndexedDB caching
 */

import { 
  uploadFile as ipfsUploadFile, 
  uploadBrowserFile as ipfsUploadBrowserFile 
} from '@/lib/ipfs/upload';
import {
  retrieveFile as ipfsRetrieveFile, 
  retrieveBlob as ipfsRetrieveBlob,
  retrieveObjectURL as ipfsRetrieveObjectURL,
  streamAudioFromIPFS as ipfsStreamAudio,
  createIPFSAudioElement as ipfsCreateAudioElement,
  isAvailableLocally as ipfsIsAvailableLocally
} from '@/lib/ipfs/retrieve';
import { 
  seedFile as webtorrentSeedFile, 
  streamAudio as webtorrentStreamAudio,
  isWebTorrentSupported 
} from '@/lib/p2p/webtorrent';
import { isIPFSSupported } from '@/lib/ipfs/client';

// Storage configuration constants
export const STORAGE_CONFIG = {
  LOCAL_CACHE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB (realistic browser limit)
    CLEANUP_THRESHOLD: 0.8, // Clean when 80% full
    PREFIX: 'p2p-music-cache-'
  },
  CACHE_API: {
    MAX_SIZE: 100 * 1024 * 1024, // 100MB
    CLEANUP_THRESHOLD: 0.9,
    PREFIX: 'p2p-music-cache-api-'
  },
  LOCAL_STORAGE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB localStorage limit
    PREFIX: 'p2p-music-'
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY: 1000,
    MAX_DELAY: 10000
  },
  TIMEOUT: {
    DEFAULT: 30000, // 30 seconds
    UPLOAD: 60000,  // 1 minute
    DOWNLOAD: 45000 // 45 seconds
  }
} as const;

// Storage system configuration
export enum StorageSystem {
  IPFS = 'ipfs',
  WEB_TORRENT = 'webtorrent',
  CACHE_API = 'cache-api',
  INDEXED_DB = 'indexeddb',
  FILE_SYSTEM = 'file-system',
  SERVER_FILE_SYSTEM = 'server-file-system',
  LOCAL_STORAGE = 'local-storage',
  CLOUD_FALLBACK = 'cloud-fallback'
}

// Storage priority order for fallback (server filesystem is last resort)
const STORAGE_PRIORITY = [
  StorageSystem.IPFS,
  StorageSystem.WEB_TORRENT,
  StorageSystem.CACHE_API,
  StorageSystem.INDEXED_DB,
  StorageSystem.FILE_SYSTEM,
  StorageSystem.SERVER_FILE_SYSTEM,
  StorageSystem.CLOUD_FALLBACK,
];

// Browser Storage Cache for metadata (LocalStorage/SessionStorage)
class BrowserStorageCache {
  private static PREFIX = 'p2p-music-';
  private static MAX_SIZE = 5 * 1024 * 1024; // 5MB localStorage limit
  
  static async setMetadata(key: string, metadata: StorageMetadata): Promise<boolean> {
    try {
      const data = JSON.stringify(metadata);
      if (data.length > this.MAX_SIZE) return false;
      localStorage.setItem(`${this.PREFIX}meta-${key}`, data);
      return true;
    } catch {
      return false;
    }
  }
  
  static async getMetadata(key: string): Promise<StorageMetadata | null> {
    try {
      const data = localStorage.getItem(`${this.PREFIX}meta-${key}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }
}

// Cache API Storage implementation
class CacheAPIStorage {
  private static CACHE_NAME = 'p2p-music-files-v1';
  private static MAX_SIZE = 100 * 1024 * 1024; // 100MB
  
  static async getCacheSize(): Promise<number> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const keys = await cache.keys();
      let totalSize = 0;
      for (const key of keys) {
        const response = await cache.match(key);
        if (response) {
          const size = response.headers.get('content-length') || '0';
          totalSize += parseInt(size, 10);
        }
      }
      return totalSize;
    } catch {
      return 0;
    }
  }
  
  static async cleanupOldEntries(): Promise<void> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const keys = await cache.keys();
      
      // Get all entries sorted by timestamp
      const entries = await Promise.all(
        keys.map(async (key) => {
          const response = await cache.match(key);
          const timestamp = response?.headers.get('x-timestamp') || Date.now().toString();
          return { key, timestamp: parseInt(timestamp, 10) };
        })
      );
      
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);
      
      // Calculate current size
      let currentSize = 0;
      for (const entry of entries) {
        const response = await cache.match(entry.key);
        const size = response?.headers.get('content-length') || '0';
        currentSize += parseInt(size, 10);
      }
      
      // Cleanup until we're under the threshold
      const targetSize = STORAGE_CONFIG.CACHE_API.MAX_SIZE * STORAGE_CONFIG.CACHE_API.CLEANUP_THRESHOLD;
      while (currentSize > targetSize && entries.length > 0) {
        const oldestEntry = entries.shift();
        if (oldestEntry) {
          await cache.delete(oldestEntry.key);
          currentSize -= oldestEntry.timestamp;
          console.log(`Cleaned up old cache entry: ${oldestEntry.key}`);
        }
      }
    } catch {
      // Ignore errors
    }
  }
  
  static async set(key: string, data: Uint8Array, mimeType: string): Promise<boolean> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const response = new Response(data as unknown as BodyInit, {
        headers: { 'Content-Type': mimeType, 'x-timestamp': Date.now().toString() }
      });
      await cache.put(key, response);
      return true;
    } catch {
      return false;
    }
  }
  
  static async get(key: string): Promise<Uint8Array | null> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      const response = await cache.match(key);
      if (!response) return null;
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch {
      return null;
    }
  }
  
  static async delete(key: string): Promise<void> {
    try {
      const cache = await caches.open(this.CACHE_NAME);
      await cache.delete(key);
    } catch {
      // Ignore errors
    }
  }
}

// File System Access API Storage implementation
class FileSystemStorage {
  private static dirHandle: FileSystemDirectoryHandle | null = null;
  
  static async initialize(): Promise<boolean> {
    try {
      if ('showDirectoryPicker' in window) {
        this.dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite'
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  
  static async set(filename: string, data: Uint8Array): Promise<boolean> {
    try {
      if (!this.dirHandle) return false;
      const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(data as unknown as FileSystemWriteChunkType);
      await writable.close();
      return true;
    } catch {
      return false;
    }
  }
  
  static async get(filename: string): Promise<Uint8Array | null> {
    try {
      if (!this.dirHandle) return null;
      const fileHandle = await this.dirHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      return new Uint8Array(buffer);
    } catch {
      return null;
    }
  }
}

// Cloud Storage Fallback implementation
class CloudStorageFallback {
  private static endpoint: string = '';
  private static apiKey: string = '';
  
  static configure(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }
  
  static async upload(file: Uint8Array, metadata: StorageMetadata): Promise<string> {
    const formData = new FormData();
    formData.append('file', new Blob([file as unknown as BlobPart]));
    formData.append('metadata', JSON.stringify(metadata));
    
    const response = await fetch(`${this.endpoint}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: formData
    });
    
    const result = await response.json();
    return result.id;
  }
  
  static async download(id: string): Promise<Uint8Array> {
    const response = await fetch(`${this.endpoint}/download/${id}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
}

// Server File System Storage implementation (for server-side filesystem)
class ServerFileSystemStorage {
  private static endpoint: string = '/api/storage';
  private static accessToken: string = '';
  
  static configure(endpoint: string, accessToken: string) {
    this.endpoint = endpoint || '/api/storage';
    this.accessToken = accessToken;
  }
  
  static async upload(file: Uint8Array, filename: string, mimeType: string): Promise<{ id: string; path: string }> {
    const formData = new FormData();
    formData.append('file', new Blob([file as unknown as BlobPart], { type: mimeType }), filename);
    
    const response = await fetch(`${this.endpoint}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Server upload failed');
    }
    
    const result = await response.json();
    return { id: result.id, path: result.path };
  }
  
  static async download(id: string): Promise<Uint8Array> {
    const response = await fetch(`${this.endpoint}/download?id=${encodeURIComponent(id)}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Server download failed');
    }
    
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
  
  static async delete(id: string): Promise<boolean> {
    const response = await fetch(`${this.endpoint}/delete/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });
    
    return response.ok;
  }
  
  static async exists(id: string): Promise<boolean> {
    const response = await fetch(`${this.endpoint}/exists/${id}`, {
      method: 'HEAD',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });
    
    return response.ok;
  }
}

// IndexedDB Cache implementation
class IndexedDBCache {
  private static DB_NAME = 'p2p-music-cache';
  private static STORE_NAME = 'files';
  
  private static async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }
  
  static async set(key: string, data: Uint8Array): Promise<boolean> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.STORE_NAME], 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.put({ key, data, timestamp: Date.now() });
      
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }
  
  static async get(key: string): Promise<Uint8Array | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.STORE_NAME], 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.get(key);
      
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result?.data || null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }
  
  static async remove(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.STORE_NAME], 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.delete(key);
      
      return new Promise<void>((resolve) => {
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    } catch {
      // Ignore errors
    }
  }
  
  static async getAllKeys(): Promise<string[]> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.STORE_NAME], 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.getAllKeys();
      
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result as unknown as string[]);
        request.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }
  
  static async cleanupOldEntries(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.STORE_NAME], 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      
      // Get all entries sorted by timestamp (oldest first)
      const request = store.getAll();
      
      await new Promise<void>((resolve) => {
        request.onsuccess = () => {
          const entries = request.result;
          entries.sort((a: any, b: any) => a.timestamp - b.timestamp);
          
          // Calculate current size
          let currentSize = 0;
          for (const entry of entries) {
            currentSize += entry.data.length;
          }
          
          // Cleanup until we're under the threshold
          const targetSize = STORAGE_CONFIG.LOCAL_CACHE.MAX_SIZE * STORAGE_CONFIG.LOCAL_CACHE.CLEANUP_THRESHOLD;
          let cleanupCount = 0;
          
          const cleanupNext = () => {
            if (currentSize > targetSize && entries.length > cleanupCount) {
              const oldestEntry = entries[cleanupCount];
              const deleteRequest = store.delete(oldestEntry.key);
              
              deleteRequest.onsuccess = () => {
                currentSize -= oldestEntry.data.length;
                console.log(`Cleaned up old cache entry: ${oldestEntry.key} (${(oldestEntry.data.length / 1024 / 1024).toFixed(2)} MB)`);
                cleanupCount++;
                cleanupNext();
              };
              
              deleteRequest.onerror = () => {
                cleanupCount++;
                cleanupNext();
              };
            } else {
              resolve();
            }
          };
          
          cleanupNext();
        };
        
        request.onerror = () => {
          resolve();
        };
      });
    } catch {
      // Ignore errors
    }
  }
}

// Track metadata interface for storage operations
export interface StorageMetadata {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  year?: number;
  duration?: number;
  description?: string;
  mimeType?: string;
}

// Storage result interface
export interface StorageResult {
  id: string;
  system: StorageSystem;
  url?: string;
  magnetUri?: string;
  ipfsCid?: string;
  size: number;
  timestamp: number;
}

// Storage options
export interface StorageOptions {
  /** Preferred storage system (defaults to automatic) */
  preferredSystem?: StorageSystem;
  /** Maximum time to wait for primary system before falling back */
  timeout?: number;
  /** Whether to cache in IndexedDB */
  cache?: boolean;
  /** Progress callback */
  onProgress?: (progress: number) => void;
  /** Enable redundancy (upload to multiple systems) */
  redundant?: boolean;
}

// Check if storage system is available
function isStorageSystemAvailable(system: StorageSystem): boolean {
  switch (system) {
    case StorageSystem.IPFS:
      return isIPFSSupported();
    case StorageSystem.WEB_TORRENT:
      return isWebTorrentSupported();
    case StorageSystem.CACHE_API:
      return typeof caches !== 'undefined';
    case StorageSystem.INDEXED_DB:
      return typeof indexedDB !== 'undefined';
    case StorageSystem.FILE_SYSTEM:
      return 'showDirectoryPicker' in window;
    case StorageSystem.SERVER_FILE_SYSTEM:
      // Server file system is always available if we have network access
      return typeof fetch !== 'undefined';
    case StorageSystem.LOCAL_STORAGE:
      return typeof localStorage !== 'undefined';
    case StorageSystem.CLOUD_FALLBACK:
      return !!CloudStorageFallback['endpoint'] && !!CloudStorageFallback['apiKey'];
    default:
      return false;
  }
}

// Get available storage systems in priority order
function getAvailableStorageSystems(): StorageSystem[] {
  return STORAGE_PRIORITY.filter(isStorageSystemAvailable);
}

// Unified storage service
export class UnifiedStorage {
  /**
   * Retry with exponential backoff
   */
  private static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = STORAGE_CONFIG.RETRY.MAX_ATTEMPTS,
    baseDelay: number = STORAGE_CONFIG.RETRY.BASE_DELAY
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        const delay = Math.min(baseDelay * Math.pow(2, i), STORAGE_CONFIG.RETRY.MAX_DELAY);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Timeout wrapper
   */
  private static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      )
    ]);
  }

  /**
   * Upload file to storage with fallback mechanism
   */
  static async uploadFile(
    file: File | Uint8Array,
    metadata: StorageMetadata,
    options: StorageOptions = {}
  ): Promise<StorageResult> {
    const availableSystems = getAvailableStorageSystems();
    if (availableSystems.length === 0) {
      throw new Error('No storage systems available');
    }

    // Determine which systems to try
    const systemsToTry = options.preferredSystem 
      ? [options.preferredSystem, ...availableSystems.filter(s => s !== options.preferredSystem)]
      : availableSystems;

    let lastError: Error | null = null;

    // Try each storage system in order with progress scaling
    for (let i = 0; i < systemsToTry.length; i++) {
      const system = systemsToTry[i];
      const progressOffset = (i / systemsToTry.length) * 100;
      const progressScale = 100 / systemsToTry.length;
      
      try {
        console.log(`Attempting upload to ${system}`);
        
        const adjustedOptions = {
          ...options,
          onProgress: (progress: number) => {
            options.onProgress?.(progressOffset + (progress * progressScale / 100));
          }
        };
        
        let result: StorageResult;
        
        switch (system) {
          case StorageSystem.IPFS:
            result = await this.withTimeout(
              this.uploadToIPFS(file, metadata, adjustedOptions),
              options.timeout || STORAGE_CONFIG.TIMEOUT.UPLOAD
            );
            break;
          
          case StorageSystem.WEB_TORRENT:
            result = await this.withTimeout(
              this.uploadToWebTorrent(file, metadata, adjustedOptions),
              options.timeout || STORAGE_CONFIG.TIMEOUT.UPLOAD
            );
            break;
          
          case StorageSystem.CACHE_API:
            result = await this.withTimeout(
              this.uploadToCacheAPI(file, metadata, adjustedOptions),
              options.timeout || STORAGE_CONFIG.TIMEOUT.UPLOAD
            );
            break;
          
          case StorageSystem.INDEXED_DB:
            result = await this.uploadToIndexedDB(file, metadata, adjustedOptions);
            break;
          
          case StorageSystem.FILE_SYSTEM:
            result = await this.withTimeout(
              this.uploadToFileSystem(file, metadata, adjustedOptions),
              options.timeout || STORAGE_CONFIG.TIMEOUT.UPLOAD
            );
            break;
          
          case StorageSystem.CLOUD_FALLBACK:
            result = await this.withTimeout(
              this.uploadToCloudFallback(file, metadata, adjustedOptions),
              options.timeout || STORAGE_CONFIG.TIMEOUT.UPLOAD
            );
            break;
          
          case StorageSystem.LOCAL_STORAGE:
            result = await this.withTimeout(
              this.uploadToLocalStorage(file, metadata, adjustedOptions),
              options.timeout || STORAGE_CONFIG.TIMEOUT.UPLOAD
            );
            break;
          
          case StorageSystem.SERVER_FILE_SYSTEM:
            result = await this.withTimeout(
              this.uploadToServerFileSystem(file, metadata, adjustedOptions),
              options.timeout || STORAGE_CONFIG.TIMEOUT.UPLOAD
            );
            break;
          
          default:
            continue;
        }

        console.log(`Successfully uploaded to ${system}`);
        
        // If redundant mode, attempt to upload to other systems in parallel
        if (options.redundant && systemsToTry.length > 1) {
          const otherSystems = systemsToTry.filter(s => s !== system);
          otherSystems.forEach(async (otherSystem) => {
            try {
              await this.uploadToSystem(otherSystem, file, metadata, options);
              console.log(`Redundant upload to ${otherSystem} successful`);
            } catch (error) {
              console.warn(`Redundant upload to ${otherSystem} failed:`, error);
            }
          });
        }

        return result;

      } catch (error) {
        lastError = error as Error;
        console.error(`Failed to upload to ${system}:`, lastError);
        continue; // Try next system
      }
    }

    throw new Error(
      `All storage systems failed. Tried: ${systemsToTry.join(', ')}. ` +
      `Last error: ${lastError?.message}`
    );
  }

  /**
   * Upload to specific storage system
   */
  private static async uploadToSystem(
    system: StorageSystem,
    file: File | Uint8Array,
    metadata: StorageMetadata,
    options: StorageOptions
  ): Promise<StorageResult> {
    switch (system) {
      case StorageSystem.IPFS:
        return await this.uploadToIPFS(file, metadata, options);
      case StorageSystem.WEB_TORRENT:
        return await this.uploadToWebTorrent(file, metadata, options);
      case StorageSystem.CACHE_API:
        return await this.uploadToCacheAPI(file, metadata, options);
      case StorageSystem.INDEXED_DB:
        return await this.uploadToIndexedDB(file, metadata, options);
      case StorageSystem.FILE_SYSTEM:
        return await this.uploadToFileSystem(file, metadata, options);
      case StorageSystem.CLOUD_FALLBACK:
        return await this.uploadToCloudFallback(file, metadata, options);
      case StorageSystem.LOCAL_STORAGE:
        return await this.uploadToLocalStorage(file, metadata, options);
      case StorageSystem.SERVER_FILE_SYSTEM:
        return await this.uploadToServerFileSystem(file, metadata, options);
      default:
        throw new Error(`Unsupported storage system: ${system}`);
    }
  }

  /**
   * Upload to IPFS with retry
   */
  private static async uploadToIPFS(
    file: File | Uint8Array,
    metadata: StorageMetadata,
    options: StorageOptions
  ): Promise<StorageResult> {
    return this.retryWithBackoff(async () => {
      let result;
      if (file instanceof File) {
        result = await ipfsUploadBrowserFile(file, {
          onProgress: (progress) => options.onProgress?.(progress.percentage)
        });
      } else {
        result = await ipfsUploadFile(file, {
          onProgress: (progress) => options.onProgress?.(progress.percentage)
        });
      }

      return {
        id: result.cid,
        system: StorageSystem.IPFS,
        url: result.gatewayUrl,
        ipfsCid: result.cid,
        size: result.size,
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Upload to WebTorrent with retry
   */
  private static async uploadToWebTorrent(
    file: File | Uint8Array,
    metadata: StorageMetadata,
    options: StorageOptions
  ): Promise<StorageResult> {
    return this.retryWithBackoff(async () => {
      let browserFile: File;
      if (file instanceof File) {
        browserFile = file;
      } else {
        const mimeType = 'audio/mpeg'; // Default
        browserFile = new File([file as unknown as BlobPart], `${metadata.title || 'unknown'}.mp3`, { type: mimeType });
      }

      const result = await webtorrentSeedFile(browserFile, {
        name: metadata.title,
        comment: metadata.description,
      });

      return {
        id: result.infoHash,
        system: StorageSystem.WEB_TORRENT,
        magnetUri: result.magnetURI,
        size: browserFile.size,
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Upload to Cache API
   */
  private static async uploadToCacheAPI(
    file: File | Uint8Array,
    metadata: StorageMetadata,
    options: StorageOptions
  ): Promise<StorageResult> {
    return this.retryWithBackoff(async () => {
      let data: Uint8Array;
      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        data = new Uint8Array(arrayBuffer);
      } else {
        data = file;
      }
      
      const cacheKey = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Cleanup old entries if needed
      await CacheAPIStorage.cleanupOldEntries();
      
      const success = await CacheAPIStorage.set(cacheKey, data, metadata.mimeType || 'application/octet-stream');
      
      if (!success) {
        throw new Error('Failed to store in Cache API');
      }
      
      return {
        id: cacheKey,
        system: StorageSystem.CACHE_API,
        size: data.length,
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Upload to File System Access API
   */
  private static async uploadToFileSystem(
    file: File | Uint8Array,
    metadata: StorageMetadata,
    options: StorageOptions
  ): Promise<StorageResult> {
    return this.retryWithBackoff(async () => {
      let data: Uint8Array;
      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        data = new Uint8Array(arrayBuffer);
      } else {
        data = file;
      }

      // Initialize file system if not already initialized
      if (!FileSystemStorage['dirHandle']) {
        const initialized = await FileSystemStorage.initialize();
        if (!initialized) {
          throw new Error('File system access not granted');
        }
      }

      const filename = file instanceof File ? file.name : `${metadata.title || 'unknown'}.mp3`;
      const success = await FileSystemStorage.set(filename, data);

      if (!success) {
        throw new Error('Failed to store in File System');
      }

      return {
        id: filename,
        system: StorageSystem.FILE_SYSTEM,
        size: data.length,
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Upload to Cloud Storage Fallback
   */
  private static async uploadToCloudFallback(
    file: File | Uint8Array,
    metadata: StorageMetadata,
    options: StorageOptions
  ): Promise<StorageResult> {
    return this.retryWithBackoff(async () => {
      let data: Uint8Array;
      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        data = new Uint8Array(arrayBuffer);
      } else {
        data = file;
      }

      const id = await CloudStorageFallback.upload(data, metadata);

      return {
        id,
        system: StorageSystem.CLOUD_FALLBACK,
        size: data.length,
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Upload to LocalStorage (metadata only)
   */
  private static async uploadToLocalStorage(
    file: File | Uint8Array,
    metadata: StorageMetadata,
    options: StorageOptions
  ): Promise<StorageResult> {
    return this.retryWithBackoff(async () => {
      const key = `meta-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const success = await BrowserStorageCache.setMetadata(key, metadata);

      if (!success) {
        throw new Error('Failed to store metadata in LocalStorage');
      }

      return {
        id: key,
        system: StorageSystem.LOCAL_STORAGE,
        size: 0, // Metadata only
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Upload to Server File System (via API)
   */
  private static async uploadToServerFileSystem(
    file: File | Uint8Array,
    metadata: StorageMetadata,
    options: StorageOptions
  ): Promise<StorageResult> {
    return this.retryWithBackoff(async () => {
      let data: Uint8Array;
      let mimeType = metadata.mimeType || 'audio/mpeg';
      let filename: string;

      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        data = new Uint8Array(arrayBuffer);
        mimeType = file.type || mimeType;
        filename = file.name;
      } else {
        data = file;
        filename = `${metadata.title || 'unknown'}.mp3`;
      }

      const result = await ServerFileSystemStorage.upload(data, filename, mimeType);

      return {
        id: result.id,
        system: StorageSystem.SERVER_FILE_SYSTEM,
        url: `${ServerFileSystemStorage['endpoint']}/download/${result.id}`,
        size: data.length,
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Upload to IndexedDB
   */
  private static async uploadToIndexedDB(
    file: File | Uint8Array,
    metadata: StorageMetadata,
    options: StorageOptions
  ): Promise<StorageResult> {
    return this.retryWithBackoff(async () => {
      let data: Uint8Array;
      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        data = new Uint8Array(arrayBuffer);
      } else {
        data = file;
      }

      const cacheKey = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Cleanup old entries if needed
      await IndexedDBCache.cleanupOldEntries();
      
      const success = await IndexedDBCache.set(cacheKey, data);
      
      if (!success) {
        throw new Error('Failed to store in IndexedDB');
      }

      return {
        id: cacheKey,
        system: StorageSystem.INDEXED_DB,
        size: data.length,
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Retrieve file from storage with fallback mechanism
   */
  static async retrieveFile(
    id: string,
    options: StorageOptions = {}
  ): Promise<Uint8Array> {
    // First check IndexedDB cache
    if (options.cache !== false) {
      const cachedData = await IndexedDBCache.get(id);
      if (cachedData) {
        console.log('Retrieving from IndexedDB cache');
        return cachedData;
      }
    }

    const availableSystems = getAvailableStorageSystems();
    if (availableSystems.length === 0) {
      throw new Error('No storage systems available');
    }

    let lastError: Error | null = null;

    // Try each storage system in order
    for (let i = 0; i < availableSystems.length; i++) {
      const system = availableSystems[i];
      const progressOffset = (i / availableSystems.length) * 100;
      const progressScale = 100 / availableSystems.length;
      
      try {
        console.log(`Attempting retrieval from ${system}`);
        
        const adjustedOptions = {
          ...options,
          onProgress: (progress: number) => {
            options.onProgress?.(progressOffset + (progress * progressScale / 100));
          }
        };
        
        let data: Uint8Array;
        
        switch (system) {
          case StorageSystem.IPFS:
            data = await this.withTimeout(
              this.retrieveFromIPFS(id, adjustedOptions),
              options.timeout || STORAGE_CONFIG.TIMEOUT.DOWNLOAD
            );
            break;
          
          case StorageSystem.WEB_TORRENT:
            data = await this.withTimeout(
              this.retrieveFromWebTorrent(id, adjustedOptions),
              options.timeout || STORAGE_CONFIG.TIMEOUT.DOWNLOAD
            );
            break;
          
          case StorageSystem.CACHE_API:
            data = await this.withTimeout(
              this.retrieveFromCacheAPI(id, adjustedOptions),
              options.timeout || STORAGE_CONFIG.TIMEOUT.DOWNLOAD
            );
            break;
          
          case StorageSystem.INDEXED_DB:
            const cacheData = await IndexedDBCache.get(id);
            if (cacheData) {
              data = cacheData;
            } else {
              throw new Error('File not found in IndexedDB');
            }
            break;
          
          case StorageSystem.FILE_SYSTEM:
            data = await this.withTimeout(
              this.retrieveFromFileSystem(id, adjustedOptions),
              options.timeout || STORAGE_CONFIG.TIMEOUT.DOWNLOAD
            );
            break;
          
          case StorageSystem.CLOUD_FALLBACK:
            data = await this.withTimeout(
              this.retrieveFromCloudFallback(id, adjustedOptions),
              options.timeout || STORAGE_CONFIG.TIMEOUT.DOWNLOAD
            );
            break;
          
          case StorageSystem.LOCAL_STORAGE:
            // Local storage is for metadata only
            throw new Error('LocalStorage only stores metadata, not file content');
          
          case StorageSystem.SERVER_FILE_SYSTEM:
            data = await this.withTimeout(
              this.retrieveFromServerFileSystem(id, adjustedOptions),
              options.timeout || STORAGE_CONFIG.TIMEOUT.DOWNLOAD
            );
            break;
          
          default:
            continue;
        }

        // Cache the result
        if (options.cache !== false) {
          await IndexedDBCache.set(id, data);
        }

        console.log(`Successfully retrieved from ${system}`);
        return data;

      } catch (error) {
        lastError = error as Error;
        console.error(`Failed to retrieve from ${system}:`, lastError);
        continue; // Try next system
      }
    }

    throw new Error(
      `All storage systems failed. Tried: ${availableSystems.join(', ')}. ` +
      `Last error: ${lastError?.message}`
    );
  }

  /**
   * Retrieve from IPFS with retry
   */
  private static async retrieveFromIPFS(
    id: string,
    options: StorageOptions
  ): Promise<Uint8Array> {
    return this.retryWithBackoff(async () => {
      return await ipfsRetrieveFile(id, {
        onProgress: (progress) => options.onProgress?.(progress.percentage || 0)
      });
    });
  }

  /**
   * Retrieve from Cache API
   */
  private static async retrieveFromCacheAPI(
    id: string,
    options: StorageOptions
  ): Promise<Uint8Array> {
    return this.retryWithBackoff(async () => {
      const data = await CacheAPIStorage.get(id);
      if (!data) {
        throw new Error('File not found in Cache API');
      }
      return data;
    });
  }

  /**
   * Retrieve from File System Access API
   */
  private static async retrieveFromFileSystem(
    id: string,
    options: StorageOptions
  ): Promise<Uint8Array> {
    return this.retryWithBackoff(async () => {
      // Initialize file system if not already initialized
      if (!FileSystemStorage['dirHandle']) {
        const initialized = await FileSystemStorage.initialize();
        if (!initialized) {
          throw new Error('File system access not granted');
        }
      }

      const data = await FileSystemStorage.get(id);
      if (!data) {
        throw new Error('File not found in File System');
      }

      return data;
    });
  }

  /**
   * Retrieve from Cloud Storage Fallback
   */
  private static async retrieveFromCloudFallback(
    id: string,
    options: StorageOptions
  ): Promise<Uint8Array> {
    return this.retryWithBackoff(async () => {
      const data = await CloudStorageFallback.download(id);
      return data;
    });
  }

  /**
   * Retrieve from Server File System (via API)
   */
  private static async retrieveFromServerFileSystem(
    id: string,
    options: StorageOptions
  ): Promise<Uint8Array> {
    return this.retryWithBackoff(async () => {
      const data = await ServerFileSystemStorage.download(id);
      return data;
    });
  }

  /**
   * Retrieve from WebTorrent with retry
   */
  private static async retrieveFromWebTorrent(
    id: string,
    options: StorageOptions
  ): Promise<Uint8Array> {
    return this.retryWithBackoff(async () => {
      // For WebTorrent, id could be infoHash or magnet URI
      const magnetUri = id.startsWith('magnet:') ? id : `magnet:?xt=urn:btih:${id}`;
      const result = await webtorrentStreamAudio(magnetUri, {
        onProgress: (progress) => options.onProgress?.(progress)
      });
      
      // Get the file data
      return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        result.file.createReadStream()
          .on('data', (chunk: Buffer) => chunks.push(Uint8Array.from(chunk)))
          .on('end', () => {
            const data = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
            let offset = 0;
            for (const chunk of chunks) {
              data.set(chunk, offset);
              offset += chunk.length;
            }
            resolve(data);
          })
          .on('error', reject);
      });
    });
  }

  /**
   * Retrieve file as blob with fallback mechanism
   */
  static async retrieveBlob(
    id: string,
    mimeType: string = 'application/octet-stream',
    options: StorageOptions = {}
  ): Promise<Blob> {
    const data = await this.retrieveFile(id, options);
    return new Blob([data as unknown as BlobPart], { type: mimeType });
  }

  /**
   * Retrieve file as object URL with fallback mechanism
   */
  static async retrieveObjectURL(
    id: string,
    mimeType: string = 'application/octet-stream',
    options: StorageOptions = {}
  ): Promise<string> {
    const blob = await this.retrieveBlob(id, mimeType, options);
    return URL.createObjectURL(blob);
  }

  /**
   * Stream audio with fallback mechanism
   */
  static async streamAudio(
    id: string,
    mimeType: string = 'audio/mpeg',
    options: StorageOptions = {}
  ): Promise<HTMLAudioElement> {
    const availableSystems = getAvailableStorageSystems();
    if (availableSystems.length === 0) {
      throw new Error('No storage systems available');
    }

    let lastError: Error | null = null;

    // Try each storage system in order
    for (let i = 0; i < availableSystems.length; i++) {
      const system = availableSystems[i];
      
      try {
        console.log(`Attempting to stream audio from ${system}`);
        
        let audioElement: HTMLAudioElement;
        
        switch (system) {
          case StorageSystem.IPFS:
            audioElement = await ipfsCreateAudioElement(id, mimeType);
            break;
          
          case StorageSystem.WEB_TORRENT:
            // WebTorrent expects magnet URI, not CID
            const result = await webtorrentStreamAudio(id);
            audioElement = result.audioElement;
            break;
          
          case StorageSystem.INDEXED_DB:
            const data = await IndexedDBCache.get(id);
            if (data) {
              const blob = new Blob([data as unknown as BlobPart], { type: mimeType });
              audioElement = new Audio();
              const url = URL.createObjectURL(blob);
              audioElement.src = url;
              
              // Clean up when audio is done
              audioElement.addEventListener('ended', () => URL.revokeObjectURL(url));
              audioElement.addEventListener('error', () => URL.revokeObjectURL(url));
            } else {
              throw new Error('File not found in IndexedDB');
            }
            break;
          
          default:
            continue;
        }

        console.log(`Successfully streaming from ${system}`);
        return audioElement;

      } catch (error) {
        lastError = error as Error;
        console.error(`Failed to stream from ${system}:`, lastError);
        continue; // Try next system
      }
    }

    throw new Error(
      `All storage systems failed. Tried: ${availableSystems.join(', ')}. ` +
      `Last error: ${lastError?.message}`
    );
  }

  /**
   * Check if content is available in any storage system
   */
  static async isContentAvailable(id: string): Promise<{ available: boolean; systems: StorageSystem[] }> {
    const availableSystems: StorageSystem[] = [];

    // Check IndexedDB
    if (typeof indexedDB !== 'undefined') {
      const data = await IndexedDBCache.get(id);
      if (data) {
        availableSystems.push(StorageSystem.INDEXED_DB);
      }
    }

    // Check IPFS
    if (isIPFSSupported()) {
      try {
        const available = await ipfsIsAvailableLocally(id);
        if (available) {
          availableSystems.push(StorageSystem.IPFS);
        }
      } catch {
        // IPFS not available or failed
      }
    }

    // Note: WebTorrent availability is tricky to check without trying to download

    return {
      available: availableSystems.length > 0,
      systems: availableSystems,
    };
  }

  /**
   * Clear cache
   */
  static async clearCache(): Promise<void> {
    await IndexedDBCache.cleanupOldEntries();
  }

  /**
   * Cleanup method
   */
  static async cleanup(): Promise<void> {
    // Cleanup old cache entries
    await IndexedDBCache.cleanupOldEntries();
  }

  /**
   * Health check for storage systems
   */
  static async healthCheck(): Promise<{
    system: StorageSystem;
    available: boolean;
    latency?: number;
  }[]> {
    const systems = STORAGE_PRIORITY;
    return Promise.all(systems.map(async (system) => {
      const start = Date.now();
      try {
        const available = isStorageSystemAvailable(system);
        return { system, available, latency: Date.now() - start };
      } catch {
        return { system, available: false };
      }
    }));
  }
}

// Setup cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    UnifiedStorage.cleanup().catch(error => console.error('Cleanup error:', error));
  });
}

export default UnifiedStorage;
