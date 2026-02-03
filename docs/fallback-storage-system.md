# Fallback Storage System

## Overview

The fallback storage system is a robust, fault-tolerant mechanism that ensures content remains accessible even when one or more storage systems become unavailable. It provides automatic failover between multiple storage backends with IndexedDB as a buffer and server filesystem as a reliable fallback.

## Architecture

### Storage Systems (Ordered by Priority)

1. **IPFS (InterPlanetary File System)** - Primary distributed storage
2. **WebTorrent** - Peer-to-peer file sharing network
3. **Cache API** - Browser cache storage
4. **IndexedDB** - Browser storage with larger capacity limits
5. **File System Access API** - Local filesystem access (with user permission)
6. **Server File System** - Server-side filesystem storage (via API)
7. **Cloud Fallback** - External cloud storage service

### Fallback Mechanism

The system uses an intelligent fallback strategy:

```typescript
// Storage system priority order
const STORAGE_PRIORITY = [
  StorageSystem.IPFS,
  StorageSystem.WEB_TORRENT,
  StorageSystem.INDEXED_DB,
];
```

When uploading:
1. Attempt to use primary storage (IPFS)
2. If fails, try secondary storage (WebTorrent)
3. If both fail, fallback to browser cache systems
4. If all browser options fail, use server filesystem as last resort
5. If server filesystem fails, try cloud fallback

When retrieving:
1. Check IndexedDB cache first for quick access
2. Attempt to retrieve from primary storage
3. If fails, try secondary storage
4. Fall through to server filesystem if all P2P options fail
5. If all fail, throw error with user-friendly message

## Key Improvements

### 1. **IndexedDB Cache**
- Replaced LocalStorage with IndexedDB for larger storage capacity (5MB limit)
- Implements LRU (Least Recently Used) cleanup policy
- Handles space management automatically
- Cleanup when 80% of storage limit is reached

### 2. **Retry Logic with Exponential Backoff**
- Automatic retry for transient failures
- Configurable max retries (3 by default)
- Exponential delay between retries (1s, 2s, 4s)
- Prevents overwhelming storage systems

### 3. **Timeout Functionality**
- Implements timeout for each storage operation
- Defaults: 30 seconds for upload, 45 seconds for download
- Prevents long-hanging operations

### 4. **Redundant Uploads**
- Option to upload to multiple storage systems in parallel
- Provides redundancy and improves availability
- Background upload to secondary systems

### 5. **Enhanced Error Handling**
- Detailed error messages with system information
- Aggregates errors from all storage attempts
- User-friendly error reporting

### 6. **Improved Progress Tracking**
- Scaled progress across fallback stages
- Each system's progress contributes to overall percentage
- Better user feedback during fallback operations

### 7. **Health Checks**
- Storage system health monitoring
- Latency measurements
- Availability status

### 9. **Server Filesystem Storage**
- Files stored on server filesystem via API
- Provides reliable fallback when P2P networks unavailable
- Configurable storage directory via `STORAGE_DIR` environment variable
- Maximum file size: 100MB
- Authentication required for all operations

### 10. **Memory Leak Prevention**
- Proper cleanup of object URLs
- Automatic revoking when audio ends or errors occur

## Configuration

```typescript
export const STORAGE_CONFIG = {
  LOCAL_CACHE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB (realistic browser limit)
    CLEANUP_THRESHOLD: 0.8, // Clean when 80% full
    PREFIX: 'p2p-music-cache-'
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
```

## Usage Examples

### Basic Upload

```typescript
import { UnifiedStorage, StorageOptions } from '@/lib/storage/unifiedStorage';

const file = document.getElementById('file-input').files[0];
const metadata = {
  title: file.name,
  artist: 'Unknown Artist',
  genre: 'Unknown',
  duration: 0,
};

const options: StorageOptions = {
  preferredSystem: 'ipfs',
  cache: true,
  redundant: true, // Upload to all available systems
  onProgress: (progress) => {
    console.log(`Uploading: ${progress}%`);
  },
};

try {
  const result = await UnifiedStorage.uploadFile(file, metadata, options);
  console.log(`File uploaded successfully to ${result.system}`);
  console.log('Storage ID:', result.id);
} catch (error) {
  console.error('Upload failed:', error);
}
```

### Basic Retrieval

```typescript
import { UnifiedStorage } from '@/lib/storage/unifiedStorage';

const trackId = 'QmX...'; // IPFS CID, torrent infoHash, or local storage key

try {
  const data = await UnifiedStorage.retrieveFile(trackId);
  const audio = new Audio();
  audio.src = URL.createObjectURL(new Blob([data], { type: 'audio/mpeg' }));
  audio.play();
} catch (error) {
  console.error('Failed to retrieve track:', error);
}
```

### Stream Audio with Fallback

```typescript
import { UnifiedStorage } from '@/lib/storage/unifiedStorage';

const trackId = 'QmX...';

try {
  const audioElement = await UnifiedStorage.streamAudio(trackId);
  audioElement.play();
} catch (error) {
  console.error('Failed to stream track:', error);
}
```

### Check Availability

```typescript
import { UnifiedStorage } from '@/lib/storage/unifiedStorage';

const trackId = 'QmX...';
const availability = await UnifiedStorage.isContentAvailable(trackId);

console.log('Content available:', availability.available);
console.log('Available systems:', availability.systems);
```

### Health Check

```typescript
import { UnifiedStorage } from '@/lib/storage/unifiedStorage';

const health = await UnifiedStorage.healthCheck();
console.log('Storage system health:', health);

// Output:
// [
//   { system: 'ipfs', available: true, latency: 120 },
//   { system: 'webtorrent', available: true, latency: 85 },
//   { system: 'indexeddb', available: true, latency: 5 }
// ]
```

## Integration with Existing Components

### Upload Component
Updated `UploadComponent.tsx` to use unified storage:
- Removes direct IPFS dependency
- Uses fallback mechanism internally
- Displays storage system information to user
- Provides progress tracking
- Supports redundant uploads

### Music Player
Created `UnifiedMusicPlayer.tsx` that:
- Supports all storage systems
- Handles fallback during playback
- Shows which system is being used
- Provides error recovery options
- Performs health checks

### Tracks API
Updated `tracks/route.ts` to:
- Accept storage system information
- Store magnet URI in addition to IPFS CID
- Determine storage type from metadata
- Support querying tracks by storage type

## Browser Compatibility

The system gracefully handles different browser capabilities:

- **Modern browsers (Chrome, Firefox, Edge)**: Full support for all storage systems
- **Older browsers (Safari, IE)**: Fallback to supported mechanisms
- **Disabled JavaScript**: Limited functionality with IndexedDB only

## Performance Optimizations

### Caching Strategy
- **IndexedDB cache size limit**: Prevents browser storage overflow
- **LRU cleanup**: Removes least used items when cache is full
- **Smart caching**: Only caches content when explicitly requested

### Upload/Download Optimization
- **Chunked transfers**: Supports large files with progress tracking
- **Parallel downloads**: Attempts to use fastest available system
- **Retries with exponential backoff**: Handles transient errors

## Error Handling

The system provides comprehensive error handling:

1. **Storage system unavailable**: Shows alternative options
2. **Network errors**: Retries with fallback mechanisms
3. **Quota exceeded**: Cleans up old cache entries
4. **Corrupted data**: Validates content before use

## Server Filesystem Storage

The server filesystem storage provides a reliable fallback when P2P networks are unavailable. Files are stored on the server and accessed via authenticated API endpoints.

### Configuration

```typescript
// Environment variables
STORAGE_DIR=./uploads  // Directory for stored files (default: ./uploads)
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/storage/upload` | Upload a file to server filesystem |
| GET | `/api/storage/download?id=<id>` | Download a file from server filesystem |
| DELETE | `/api/storage/delete/<id>` | Delete a file from server filesystem |
| HEAD | `/api/storage/exists/<id>` | Check if file exists |

### Usage Example

```typescript
import { UnifiedStorage, StorageSystem } from '@/lib/storage/unifiedStorage';

// Force upload to server filesystem
const result = await UnifiedStorage.uploadFile(file, metadata, {
  preferredSystem: StorageSystem.SERVER_FILE_SYSTEM,
});

console.log('File uploaded to server:', result.id);
```

### Server-Side Setup

1. Set the `STORAGE_DIR` environment variable to specify the storage directory
2. Ensure the server process has write permissions to the storage directory
3. Configure authentication tokens for API access

## Future Enhancements

1. **Storage Quotas**: Implement per-user storage limits
2. **File Cleanup**: Automatic deletion of old files after configurable period
3. **Compression**: Optional file compression for storage efficiency
4. **Encryption**: Server-side encryption for sensitive content

## Implementation Details

### StorageResult Interface

```typescript
interface StorageResult {
  id: string;                    // Unique identifier (CID, infoHash, or local key)
  system: StorageSystem;        // Which system was used
  url?: string;                 // Gateway URL (for IPFS)
  magnetUri?: string;           // Magnet link (for WebTorrent)
  ipfsCid?: string;             // IPFS CID (for IPFS)
  size: number;                 // File size in bytes
  timestamp: number;            // Upload time
}
```

### Configuration

```typescript
interface StorageOptions {
  preferredSystem?: StorageSystem;    // Specify primary system
  timeout?: number;                   // Timeout before falling back
  cache?: boolean;                    // Enable/disable local cache
  onProgress?: (progress: number) => void; // Progress callback
  redundant?: boolean;               // Upload to all available systems
}
```

### StorageSystem Enum

```typescript
enum StorageSystem {
  IPFS = 'ipfs',
  WEB_TORRENT = 'webtorrent',
  CACHE_API = 'cache-api',
  INDEXED_DB = 'indexeddb',
  FILE_SYSTEM = 'file-system',
  SERVER_FILE_SYSTEM = 'server-file-system',
  LOCAL_STORAGE = 'local-storage',
  CLOUD_FALLBACK = 'cloud-fallback',
}
```

The fallback storage system ensures that your application remains resilient to network failures and storage system outages, providing a seamless user experience even when individual systems become unavailable.
