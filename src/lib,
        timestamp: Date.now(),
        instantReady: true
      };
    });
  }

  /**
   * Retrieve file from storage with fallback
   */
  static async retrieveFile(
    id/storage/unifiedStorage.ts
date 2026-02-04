/**
 * Unified Storage System with Quota Management and P2P Fallback
 * 
 * Priority order for realtime audio rendering:
: string,
    options: StorageOptions = {}
  ): Promise<Uint8Array> {
    const priority = QuotaManager.getStoragePriority(options);
    const availableSystems = getAvailableStorageSystems * 1. Server File System (primary for instant rendering)
 * 2. P2P Storage (IPFS/WebTorrent) for quota overflow
 * 3. Browser Cache (IndexedDB(priority);

    let lastError: Error | null = null;

    for (const system of availableSystems) {
      try {
        switch (system) {
          case StorageSystem.SERVER_FILE, Cache API) for performance
 */

import { 
  uploadFile as ipfsUploadFile, 
  uploadBrowserFile as ipfsUploadBrowserFile 
} from '@/lib/ipfs/upload';
_SYSTEM:
            return await ServerFileSystemStorage.download(id);
          
          case StorageSystem.IPFS:
            return await ipfsRetrieveFile(id);
          
          case StorageSystem.INDEXED_DB:
import {
  retrieveFile as ipfsRetrieveFile, 
  retrieveBlob as ipfsRetrieveBlob,
  retrieveObjectURL as ipfsRetrieveObjectURL,
  streamAudioFromIPFS as ip            const data = await IndexedDBCache.get(id);
            if (data) return data;
            throw new Error('File not in IndexedDB');
          
          case StorageSystem.CACHE_API:
fsStreamAudio,
  createIPFSAudioElement as ipfsCreateAudioElement,
  isAvailableLocally as ipfsIsAvailableLocally
} from '@/lib/ipfs/retrieve';
            const cacheData = await CacheAPIStorage.get(id);
            if (cacheData) return cacheData;
            throw new Error('File not in Cache API');
          
          case StorageSystem.CLOUDimport { 
  seedFile as webtorrentSeedFile, 
  streamAudio as webtorrentStreamAudio,
  isWebTorrentSupported 
} from '@/lib/p2p/webtorrent_FALLBACK:
            return await CloudStorageFallback.download(id);
        }
      } catch (error) {
        lastError = error as Error;
        continue;
      }
    }

    throw new Error(
      `Failed to retrieve file from any storage system. Last error: ${lastError?.message}`
    );
  }

  /**
   * Create audio element for streaming (realtime rendering)
';
import { isIPFSSupported } from '@/lib/ipfs/client';

// Storage configuration constants
export const STORAGE_CONFIG = {
  // User quotas (in bytes)
  DEFAULT_QUOTA: {
    FREE: 500 * 1024 * 1024,      // 500MB for free users
    PREMIUM: 5 * 1024 * 1024 *    */
  static async createAudioElement(
    id: string,
    mimeType: string,
    options: StorageOptions = {}
  ): Promise<HTMLAudioElement> {
    const priority =1024, // 5GB for premium users
  },
  // Server storage limits (per user)
  SERVER_QUOTA: {
    FREE: 100 * 1024 * 102 QuotaManager.getStoragePriority(options);
    const availableSystems = getAvailableStorageSystems(priority);

    for (const system of availableSystems) {
      try {
        switch (system)4,     // 100MB on server filesystem
    PREMIUM: 1 * 1024 * 1024 * 1024, // 1GB on server filesystem
  },
 {
          case StorageSystem.SERVER_FILE_SYSTEM:
            return new Audio(`/api/storage/stream?id=${encodeURIComponent(id)}`);
          
          case StorageSystem.IPFS:
            return await ipfs  // P2P overflow threshold - when server quota exceeded, use P2P
  P2P_OVERFLOW_THRESHOLD: 0.9, // Start P2P when 90% of server quota used
  
  LOCAL_CACHE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB (realistic browser limit)
    CLEANUPCreateAudioElement(id, mimeType);
          
          case StorageSystem.INDEXED_DB:
          case StorageSystem.CACHE_API:
            const data = await this.retrieveFile(id, options);
           _THRESHOLD: 0.8, // Clean when 80% full
    PREFIX: 'p2p-music-cache-'
  },
  CACHE_API: {
    MAX_SIZE const blob = new Blob([data], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const audioEl = new Audio(url);
            audioEl.onended = () => URL.revokeObjectURL(url);
            return audioEl;
        }
      } catch {
        continue;
      }
    }

    throw new Error('Failed to create audio element from: 100 * 1024 * 1024, // 100MB
    CLEANUP_THRESHOLD: 0.9,
    PREFIX: 'p2p-music-cache-api-'
  },
  LOCAL_STORAGE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB localStorage limit
    PREFIX: 'p2 any storage');
  }

  /**
   * Get user's storage quota status
   */
  static async getQuotaStatus(userId: string): Promise<UserQuota> {
    return QuotaManager.getp-music-'
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY: 1000,
    MAX_DELAY: 10000
  },
 UserQuota(userId);
  }

  /**
   * Check if file can be uploaded (within quota)
   */
  static async canUpload(userId: string, fileSize: number): Promise TIMEOUT: {
    DEFAULT: 30000, // 30 seconds
    UPLOAD: 60000,  // 1 minute
    DOWNLOAD: 45000 // 45 seconds
  }
} as const;

// Storage system configuration
export enum StorageSystem {
  IPFS = 'ipfs',
  WEB_TORRENT = 'webtorrent',
  CACHE<{
    allowed: boolean;
    reason?: string;
    suggestedSystem?: StorageSystem;
  }> {
    const quota = await QuotaManager.getUserQuota(userId);
    
    if (_API = 'cache-api',
  INDEXED_DB = 'indexeddb',
  FILE_SYSTEM = 'file-system',
  SERVER_FILE_SYSTEM = 'server-file-system',
  LOCAL_STORAGE = 'localquota.usedQuota + fileSize > quota.totalQuota) {
      return {
        allowed: false,
        reason: 'Storage quota exceeded',
        suggestedSystem: StorageSystem.IPFS
-storage',
  CLOUD_FALLBACK = 'cloud-fallback'
}

// Storage priority order for realtime audio (server-first for instant rendering)
const REALTIME_AUDIO_PRIORITY = [
  Storage      };
    }

    return { allowed: true };
  }

  /**
   * Delete file from storage
   */
  static async deleteFile(id: string, system: StorageSystem): Promise<boolean> {
    switch (system) {
      case StorageSystem.SERVER_FILE_SYSTEM:
        return await ServerFileSystemStorage.delete(id);
      
      case StorageSystem.INDEXED_DB:
        awaitSystem.SERVER_FILE_SYSTEM,  // Primary for instant rendering
  StorageSystem.INDEXED_DB,           // Browser cache for performance
  StorageSystem.CACHE_API,             // Additional browser cache