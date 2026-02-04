/**
 * Unified Storage Service
 * 
 * Redesigned storage system that:
 * 1. Prioritizes traditional server file storage over P2P/IPFS
 * 2. Provides instant rendering after upload (tracks available immediately)
 * 3. Implements user quotas (daily and total)
 * 4. Distributes excess data to P2P storage when quota exceeded
 */

import { writeFile, mkdir, stat, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { uploadFile, uploadTrackMetadata, getIPFSGatewayUrl } from '@/lib/ipfs';

// Configuration
export const STORAGE_DIR = process.env.STORAGE_DIR || './uploads';
export const DEFAULT_DAILY_QUOTA = 100 * 1024 * 1024; // 100MB per day
export const DEFAULT_TOTAL_QUOTA = 10 * 1024 * 1024 * 1024; // 10GB total
export const SERVER_STORAGE_PRIORITY = true; // Always prefer server storage

// ============================================
// Storage System Enum
// ============================================

export enum StorageSystem {
  IPFS = 'ipfs',
  WEB_TORRENT = 'web_torrent',
  INDEXED_DB = 'indexed_db',
  CACHE_API = 'cache_api',
  SERVER_FILE_SYSTEM = 'server_file_system',
}

// Storage threshold configuration
export const STORAGE_THRESHOLDS = {
  WARNING: 50,    // Start migrating when disk is 50% full
  CRITICAL: 70,   // Aggressive migration at 70%
  RESERVED_SPACE: 5 * 1024 * 1024 * 1024, // Keep 5GB reserved
  MIGRATION_BATCH_SIZE: 20, // Files per migration batch
  MIN_FREE_SPACE: 2 * 1024 * 1024 * 1024, // Ensure 2GB free
};

// ============================================
// Notification System
// ============================================

export type NotificationType = 'quota_warning' | 'quota_exceeded' | 'storage_fallback' | 'storage_upgrade';

export interface StorageNotification {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    dailyUsed?: number;
    dailyQuota?: number;
    totalUsed?: number;
    totalQuota?: number;
    storageType?: string;
    fileSize?: number;
  };
  createdAt: Date;
}

/**
 * Create a storage-related notification for a user
 */
export async function createStorageNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: StorageNotification['data']
): Promise<void> {
  try {
    await query(
      `INSERT INTO notifications 
       (user_id, type, title, message, data, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, type, title, message, JSON.stringify(data || {})]
    );
  } catch (error) {
    console.error('Failed to create storage notification:', error);
    // Don't throw - notification failure shouldn't fail the upload
  }
}

/**
 * Notify user when daily quota is approaching (80% threshold)
 */
export async function notifyQuotaWarning(
  userId: string,
  dailyUsed: number,
  dailyQuota: number
): Promise<void> {
  const percentage = Math.round((dailyUsed / dailyQuota) * 100);
  
  await createStorageNotification(
    userId,
    'quota_warning',
    'Storage Daily Limit Approaching',
    `You have used ${formatBytes(dailyUsed)} (${percentage}%) of your daily upload limit of ${formatBytes(dailyQuota)}.`,
    {
      dailyUsed,
      dailyQuota,
    }
  );
}

/**
 * Notify user when daily or total quota has been exceeded
 */
export async function notifyQuotaExceeded(
  userId: string,
  dailyUsed: number,
  dailyQuota: number,
  totalUsed: number,
  totalQuota: number,
  fileSize: number
): Promise<void> {
  await createStorageNotification(
    userId,
    'quota_exceeded',
    'Storage Limit Exceeded',
    `Your upload of ${formatBytes(fileSize)} could not be stored on the server. The file has been stored on the P2P network instead.`,
    {
      dailyUsed,
      dailyQuota,
      totalUsed,
      totalQuota,
      fileSize,
    }
  );
}

/**
 * Notify user that their file is being stored on P2P due to quota limits
 */
export async function notifyStorageFallback(
  userId: string,
  fileSize: number,
  storageType: 'ipfs' | 'hybrid'
): Promise<void> {
  await createStorageNotification(
    userId,
    'storage_fallback',
    'File Stored on P2P Network',
    `Due to storage quota limits, your file (${formatBytes(fileSize)}) has been stored on the decentralized P2P network. It may take a moment to become available for playback.`,
    {
      fileSize,
      storageType,
    }
  );
}

/**
 * Notify user that their file was stored on server (instant ready)
 */
export async function notifyStorageSuccess(
  userId: string,
  fileSize: number
): Promise<void> {
  // Only notify for larger files (>10MB) to avoid spam
  if (fileSize > 10 * 1024 * 1024) {
    await createStorageNotification(
      userId,
      'storage_upgrade',
      'File Uploaded Successfully',
      `Your file (${formatBytes(fileSize)}) has been uploaded to the server and is instantly ready for playback.`,
      {
        fileSize,
      }
    );
  }
}

/**
 * Check if quota warning should be sent (at 80% threshold)
 */
function shouldSendQuotaWarning(
  dailyUsed: number,
  dailyQuota: number,
  lastWarningDate: Date | null
): boolean {
  const percentage = (dailyUsed / dailyQuota) * 100;
  
  // Send warning if over 80% and haven't warned today
  if (percentage >= 80) {
    if (!lastWarningDate) return true;
    const today = new Date().toDateString();
    return lastWarningDate.toDateString() !== today;
  }
  return false;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================
// File Type Configurations
// ============================================

export const FILE_TYPES = {
  audio: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/flac', 'audio/m4a'],
    extensions: ['.mp3', '.ogg', '.wav', '.flac', '.m4a'],
  },
  image: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
  avatar: {
    maxSize: 5 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
  coverArt: {
    maxSize: 5 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
};

// ============================================
// User Quota Management
// ============================================

export interface UserQuota {
  userId: string;
  dailyQuota: number;
  totalQuota: number;
  dailyUsed: number;
  totalUsed: number;
  serverStorageUsed: number;
  p2pStorageUsed: number;
  lastUploadDate: Date;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: 'quota_exceeded' | 'storage_type' | 'ok';
  serverStorageAvailable: boolean;
  excessForP2P: boolean;
  serverStorageUsed: number;
  p2pStorageUsed: number;
  dailyQuota: number;
  dailyUsed: number;
  totalQuota: number;
  totalUsed: number;
}

/**
 * Get user's current quota usage from database
 */
export async function getUserQuota(userId: string): Promise<UserQuota | null> {
  const result = await query(
    `SELECT 
      id,
      daily_upload_quota,
      total_upload_quota,
      COALESCE((SELECT SUM(file_size) FROM posts WHERE author_id = $1 AND storage_type = 'server'), 0) as server_storage_used,
      COALESCE((SELECT SUM(file_size) FROM posts WHERE author_id = $1 AND storage_type IN ('ipfs', 'hybrid')), 0) as p2p_storage_used,
      COALESCE((SELECT SUM(file_size) FROM posts WHERE author_id = $1 AND created_at::date = CURRENT_DATE), 0) as daily_used
    FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    userId: row.id,
    dailyQuota: parseInt(row.daily_upload_quota) || DEFAULT_DAILY_QUOTA,
    totalQuota: parseInt(row.total_upload_quota) || DEFAULT_TOTAL_QUOTA,
    dailyUsed: parseInt(row.daily_used) || 0,
    totalUsed: parseInt(row.server_storage_used) + parseInt(row.p2p_storage_used) || 0,
    serverStorageUsed: parseInt(row.server_storage_used) || 0,
    p2pStorageUsed: parseInt(row.p2p_storage_used) || 0,
    lastUploadDate: new Date(),
  };
}

/**
 * Check if user can upload and which storage to use
 * Returns quota status and recommended storage type
 */
export async function checkUserQuota(
  userId: string,
  fileSize: number
): Promise<QuotaCheckResult> {
  const quota = await getUserQuota(userId);
  
  if (!quota) {
    return {
      allowed: false,
      reason: 'storage_type',
      serverStorageAvailable: false,
      excessForP2P: false,
      serverStorageUsed: 0,
      p2pStorageUsed: 0,
      dailyQuota: 0,
      dailyUsed: 0,
      totalQuota: 0,
      totalUsed: 0,
    };
  }

  const dailyRemaining = quota.dailyQuota - quota.dailyUsed;
  const totalRemaining = quota.totalQuota - quota.totalUsed;

  // Check if within daily quota
  if (quota.dailyUsed + fileSize > quota.dailyQuota) {
    return {
      allowed: true,
      reason: 'ok',
      serverStorageAvailable: false,
      excessForP2P: true,
      serverStorageUsed: quota.serverStorageUsed,
      p2pStorageUsed: quota.p2pStorageUsed,
      dailyQuota: quota.dailyQuota,
      dailyUsed: quota.dailyUsed,
      totalQuota: quota.totalQuota,
      totalUsed: quota.totalUsed,
    };
  }

  // Check if within total quota
  if (quota.totalUsed + fileSize > quota.totalQuota) {
    return {
      allowed: true,
      reason: 'ok',
      serverStorageAvailable: false,
      excessForP2P: true,
      serverStorageUsed: quota.serverStorageUsed,
      p2pStorageUsed: quota.p2pStorageUsed,
      dailyQuota: quota.dailyQuota,
      dailyUsed: quota.dailyUsed,
      totalQuota: quota.totalQuota,
      totalUsed: quota.totalUsed,
    };
  }

  // Within quotas - use server storage (priority)
  return {
    allowed: true,
    reason: 'ok',
    serverStorageAvailable: true,
    excessForP2P: false,
    serverStorageUsed: quota.serverStorageUsed,
    p2pStorageUsed: quota.p2pStorageUsed,
    dailyQuota: quota.dailyQuota,
    dailyUsed: quota.dailyUsed,
    totalQuota: quota.totalQuota,
    totalUsed: quota.totalUsed,
  };
}

/**
 * Update user's storage usage after upload
 */
export async function updateUserStorageUsage(
  userId: string,
  fileSize: number,
  storageType: 'server' | 'ipfs' | 'hybrid'
): Promise<void> {
  // Storage usage is calculated dynamically from posts table
  // This function is a placeholder for any additional tracking
  await query(
    `UPDATE users SET updated_at = NOW() WHERE id = $1`,
    [userId]
  );
}

// ============================================
// Server Storage Operations
// ============================================

export interface ServerStorageResult {
  success: boolean;
  fileId: string;
  storageType: 'server';
  path: string;
  url: string;
  size: number;
  mimeType: string;
  instantReady: boolean;
}

/**
 * Get user storage directory path
 */
function getUserStoragePath(userId: string): string {
  return path.join(STORAGE_DIR, 'users', userId);
}

/**
 * Get user subdirectory path
 */
function getUserSubdirPath(userId: string, subdir: string): string {
  return path.join(STORAGE_DIR, 'users', userId, subdir);
}

/**
 * Ensure user directory exists
 */
async function ensureUserDir(userId: string): Promise<string> {
  const userDir = getUserStoragePath(userId);
  try {
    await mkdir(userDir, { recursive: true });
    return userDir;
  } catch (error) {
    console.error('Failed to create user directory:', error);
    throw new Error('User storage directory not available');
  }
}

/**
 * Ensure user subdirectory exists
 */
async function ensureUserSubdir(userId: string, subdir: string): Promise<string> {
  const subdirPath = getUserSubdirPath(userId, subdir);
  try {
    await mkdir(subdirPath, { recursive: true });
    return subdirPath;
  } catch (error) {
    console.error('Failed to create user subdirectory:', error);
    throw new Error('User storage subdirectory not available');
  }
}

/**
 * Generate unique file ID
 */
function generateFileId(): string {
  return crypto.randomUUID();
}

/**
 * Store file on server filesystem (primary storage)
 * Files are instantly ready after upload
 */
export async function storeOnServer(
  userId: string,
  file: File,
  fileType: string
): Promise<ServerStorageResult> {
  const typeConfig = FILE_TYPES[fileType as keyof typeof FILE_TYPES];
  if (!typeConfig) {
    throw new Error('Invalid file type category');
  }

  // Ensure subdirectory exists
  const subdir = fileType === 'avatar' ? 'avatars' : fileType === 'coverArt' ? 'coverart' : 'tracks';
  const subdirPath = await ensureUserSubdir(userId, subdir);

  // Generate unique file ID and filename
  const fileId = generateFileId();
  const ext = path.extname(file.name) || typeConfig.extensions[0];
  const filename = `${fileId}${ext}`;
  const filePath = path.join(subdirPath, filename);

  // Convert File to Buffer and save
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(filePath, buffer);

  return {
    success: true,
    fileId,
    storageType: 'server',
    path: filePath,
    url: `/api/storage/download?id=${fileId}&fileType=${fileType}`,
    size: file.size,
    mimeType: file.type,
    instantReady: true, // Always instant for server storage
  };
}

/**
 * Retrieve file from server storage
 */
export async function retrieveFromServer(
  userId: string,
  fileId: string,
  fileType: string
): Promise<{ buffer: Buffer; mimeType: string; size: number }> {
  const subdir = fileType === 'avatar' ? 'avatars' : fileType === 'coverArt' ? 'coverart' : 'tracks';
  const subdirPath = getUserSubdirPath(userId, subdir);
  
  const typeConfig = FILE_TYPES[fileType as keyof typeof FILE_TYPES];
  const extensions = typeConfig?.extensions || ['.mp3', '.ogg', '.wav', '.flac', '.m4a'];

  let filePath: string | null = null;
  for (const ext of extensions) {
    const candidatePath = path.join(subdirPath, `${fileId}${ext}`);
    if (existsSync(candidatePath)) {
      filePath = candidatePath;
      break;
    }
  }

  if (!filePath) {
    throw new Error('File not found');
  }

  const buffer = await readFile(filePath);
  const stats = await stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };

  return {
    buffer,
    mimeType: mimeTypes[ext] || 'application/octet-stream',
    size: stats.size,
  };
}

/**
 * Delete file from server storage
 */
export async function deleteFromServer(
  userId: string,
  fileId: string,
  fileType: string
): Promise<boolean> {
  const subdir = fileType === 'avatar' ? 'avatars' : fileType === 'coverArt' ? 'coverart' : 'tracks';
  const subdirPath = getUserSubdirPath(userId, subdir);
  
  const typeConfig = FILE_TYPES[fileType as keyof typeof FILE_TYPES];
  const extensions = typeConfig?.extensions || ['.mp3', '.ogg', '.wav', '.flac', '.m4a'];

  for (const ext of extensions) {
    const filePath = path.join(subdirPath, `${fileId}${ext}`);
    if (existsSync(filePath)) {
      await unlink(filePath);
      return true;
    }
  }

  return false;
}

// ============================================
// P2P/IPFS Storage Operations (Fallback)
// ============================================

export interface P2PStorageResult {
  success: boolean;
  fileId: string;
  storageType: 'ipfs' | 'hybrid';
  cid: string;
  gatewayUrl: string;
  size: number;
  instantReady: boolean;
  metadataCid?: string;
}

/**
 * Store file on IPFS (fallback storage for excess data)
 */
export async function storeOnP2P(
  file: File,
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    year?: number;
    duration?: number;
    description?: string;
    uploadedBy?: string;
  }
): Promise<P2PStorageResult> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Upload file to IPFS
  const uploadResult = await uploadFile(uint8Array);
  
  let metadataCid: string | undefined;
  let gatewayUrl = getIPFSGatewayUrl(uploadResult.cid);

  // If metadata provided, upload it too
  if (metadata) {
    const trackMetadata = {
      title: metadata.title || 'Untitled',
      artist: metadata.artist || 'Unknown Artist',
      album: metadata.album || '',
      genre: metadata.genre || '',
      year: metadata.year,
      duration: metadata.duration,
      description: metadata.description,
      audioCid: uploadResult.cid,
      uploadedAt: new Date().toISOString(),
      uploadedBy: metadata.uploadedBy || '',
    };
    const metadataResult = await uploadTrackMetadata(trackMetadata);
    metadataCid = metadataResult.cid;
  }

  return {
    success: true,
    fileId: uploadResult.cid,
    storageType: 'ipfs',
    cid: uploadResult.cid,
    gatewayUrl,
    size: uploadResult.size,
    instantReady: false, // IPFS may have propagation delay
    metadataCid,
  };
}

// ============================================
// Unified Storage Interface
// ============================================

export type StorageResult = ServerStorageResult | P2PStorageResult;

export interface UnifiedUploadOptions {
  file: File;
  fileType: string;
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    year?: number;
    duration?: number;
    description?: string;
  };
}

/**
 * Main unified upload function
 * Prioritizes server storage for instant rendering
 * Falls back to P2P when quotas exceeded
 * Sends notifications for quota warnings and storage fallbacks
 */
export async function uploadFileUnified(
  userId: string,
  options: UnifiedUploadOptions
): Promise<StorageResult> {
  const { file, fileType, metadata } = options;

  // Check user quota
  const quotaResult = await checkUserQuota(userId, file.size);

  // Priority 1: Server storage (instant rendering)
  if (quotaResult.serverStorageAvailable) {
    const serverResult = await storeOnServer(userId, file, fileType);
    
    // Update storage usage tracking
    await updateUserStorageUsage(userId, file.size, 'server');
    
    // Send success notification for larger files
    await notifyStorageSuccess(userId, file.size);
    
    // Check if approaching daily quota and send warning
    const dailyPercentage = (quotaResult.serverStorageUsed / quotaResult.dailyQuota) * 100;
    if (dailyPercentage >= 80) {
      await notifyQuotaWarning(
        userId,
        quotaResult.serverStorageUsed,
        quotaResult.dailyQuota
      );
    }
    
    return serverResult;
  }

  // Priority 2: P2P storage (fallback for excess data)
  if (quotaResult.excessForP2P) {
    const p2pResult = await storeOnP2P(file, {
      ...metadata,
      uploadedBy: userId,
    });

    // Update storage usage tracking
    await updateUserStorageUsage(userId, file.size, 'ipfs');
    
    // Send notification about P2P fallback
    await notifyQuotaExceeded(
      userId,
      quotaResult.serverStorageUsed,
      quotaResult.dailyQuota,
      quotaResult.serverStorageUsed + quotaResult.p2pStorageUsed,
      quotaResult.totalQuota,
      file.size
    );
    
    // Send storage fallback notification
    await notifyStorageFallback(userId, file.size, 'ipfs');

    return p2pResult;
  }

  // Quota exceeded - upload rejected
  throw new Error('Storage quota exceeded. Cannot upload file.');
}

/**
 * Retrieve file from appropriate storage
 */
export async function retrieveFileUnified(
  userId: string,
  storageType: 'server' | 'ipfs' | 'hybrid',
  fileId: string,
  fileType: string
): Promise<{ buffer?: Buffer; cid?: string; mimeType: string; size: number }> {
  if (storageType === 'server') {
    const serverResult = await retrieveFromServer(userId, fileId, fileType);
    return {
      buffer: serverResult.buffer,
      mimeType: serverResult.mimeType,
      size: serverResult.size,
    };
  }

  // For IPFS, return CID for client-side retrieval
  return {
    cid: fileId,
    mimeType: 'audio/mpeg', // Default, actual type from metadata
    size: 0,
  };
}

/**
 * Delete file from appropriate storage
 */
export async function deleteFileUnified(
  userId: string,
  storageType: 'server' | 'ipfs' | 'hybrid',
  fileId: string,
  fileType: string
): Promise<boolean> {
  if (storageType === 'server') {
    return deleteFromServer(userId, fileId, fileType);
  }

  // For IPFS, we just unpin (if pinning service available)
  // The data remains on network but we stop serving it
  console.log(`IPFS file ${fileId} marked for deletion from tracking`);
  return true;
}

// ============================================
// Server Storage Management
// ============================================

/**
 * Get server storage usage statistics
 */
export async function getServerStorageStats(): Promise<{
  totalSpace: number;
  usedSpace: number;
  freeSpace: number;
  usagePercentage: number;
  belowThreshold: boolean;
}> {
  try {
    // Use df command to get disk usage
    const { execSync } = await import('child_process');
    
    // Get disk usage for the storage directory
    const dfOutput = execSync(`df -B 1 "${STORAGE_DIR}" 2>/dev/null || df -B 1 / 2>/dev/null`)
      .toString()
      .trim()
      .split('\n')[1]
      .split(/\s+/);
    
    // df output: Filesystem, 1K-blocks, Used, Available, Use%, Mounted on
    // Or with -B 1: Filesystem, 1-blocks, Used, Available, Use%, Mounted on
    const totalSpace = parseInt(dfOutput[1]);
    const usedSpace = parseInt(dfOutput[2]);
    const freeSpace = parseInt(dfOutput[3]);
    const usagePercentage = parseFloat(dfOutput[4].replace('%', ''));
    
    return {
      totalSpace,
      usedSpace,
      freeSpace,
      usagePercentage,
      belowThreshold: usagePercentage >= 50,
    };
  } catch (error) {
    console.error('Failed to get server storage stats:', error);
    
    // Fallback: estimate based on storage directory size
    try {
      const dirSize = await getDirectorySize(STORAGE_DIR);
      return {
        totalSpace: 100 * 1024 * 1024 * 1024, // Assume 100GB total
        usedSpace: dirSize,
        freeSpace: 100 * 1024 * 1024 * 1024 - dirSize,
        usagePercentage: (dirSize / (100 * 1024 * 1024 * 1024)) * 100,
        belowThreshold: (dirSize / (100 * 1024 * 1024 * 1024)) * 100 >= 50,
      };
    } catch {
      // Return safe defaults
      return {
        totalSpace: 0,
        usedSpace: 0,
        freeSpace: 0,
        usagePercentage: 0,
        belowThreshold: false,
      };
    }
  }
}

/**
 * Get directory size recursively
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  
  try {
    const entries = await list_files(dirPath, true);
    
    for (const entry of entries) {
      if (entry.isFile) {
        const stats = await stat(entry.fullPath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.error('Failed to get directory size:', error);
  }
  
  return totalSize;
}

/**
 * Simple file listing (fallback if recursive ls not available)
 */
async function list_files(
  dirPath: string,
  recursive: boolean
): Promise<Array<{ fullPath: string; isFile: boolean }>> {
  const { readdir, lstat } = await import('fs/promises');
  const entries: Array<{ fullPath: string; isFile: boolean }> = [];
  
  try {
    const items = await readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      
      if (recursive && item.isDirectory()) {
        const subEntries = await list_files(fullPath, true);
        entries.push(...subEntries);
      } else {
        entries.push({
          fullPath,
          isFile: item.isFile(),
        });
      }
    }
  } catch (error) {
    console.error('Failed to list directory:', error);
  }
  
  return entries;
}

/**
 * Get oldest server-stored files for migration to P2P
 * Returns files sorted by upload date (oldest first)
 */
export async function getOldestServerFiles(
  limit: number = 10,
  excludeUserId?: string
): Promise<Array<{
  id: string;
  authorId: string;
  title: string;
  fileSize: number;
  createdAt: Date;
  serverStorageId: string;
}>> {
  let sql = `
    SELECT 
      p.id,
      p.author_id,
      p.title,
      p.file_size,
      p.created_at,
      p.server_storage_id
    FROM posts p
    WHERE p.storage_type = 'server'
      AND p.server_storage_id IS NOT NULL
  `;
  
  const params: any[] = [];
  
  if (excludeUserId) {
    sql += ` AND p.author_id != $1`;
    params.push(excludeUserId);
  }
  
  sql += ` ORDER BY p.created_at ASC LIMIT ${params.length + 1}`;
  params.push(limit);
  
  const result = await query(sql, params);
  
  return result.rows.map((row: any) => ({
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    fileSize: parseInt(row.file_size) || 0,
    createdAt: row.created_at,
    serverStorageId: row.server_storage_id,
  }));
}

/**
 * Migrate a single file from server to P2P storage
 */
export async function migrateFileToP2P(
  postId: string
): Promise<{
  success: boolean;
  postId: string;
  cid?: string;
  error?: string;
}> {
  try {
    // Get the post details
    const postResult = await query(
      `SELECT p.*, u.username as author_username 
       FROM posts p 
       JOIN users u ON p.author_id = u.id 
       WHERE p.id = $1 AND p.storage_type = 'server'`,
      [postId]
    );
    
    if (postResult.rows.length === 0) {
      return { success: false, postId, error: 'Post not found or not server storage' };
    }
    
    const post = postResult.rows[0];
    
    // Read file from server
    const filePath = path.join(
      STORAGE_DIR, 
      'users', 
      post.author_id, 
      'tracks',
      `${post.server_storage_id}.mp3`
    );
    
    if (!existsSync(filePath)) {
      // Try other extensions
      const extensions = ['.mp3', '.ogg', '.wav', '.flac', '.m4a'];
      let foundPath = null;
      for (const ext of extensions) {
        const tryPath = path.join(STORAGE_DIR, 'users', post.author_id, 'tracks', `${post.server_storage_id}${ext}`);
        if (existsSync(tryPath)) {
          foundPath = tryPath;
          break;
        }
      }
      
      if (!foundPath) {
        return { success: false, postId, error: 'File not found on server' };
      }
    }
    
    const buffer = await readFile(filePath);
    const uint8Array = new Uint8Array(buffer);
    
    // Upload to IPFS
    const uploadResult = await uploadFile(uint8Array);
    
    // Update post record
    await query(
      `UPDATE posts SET 
        storage_type = 'hybrid',
        ipfs_cid = $1,
        ipfs_gateway_url = $2,
        instant_ready = FALSE,
        updated_at = NOW()
       WHERE id = $3`,
      [uploadResult.cid, getIPFSGatewayUrl(uploadResult.cid), postId]
    );
    
    // Delete from server
    await unlink(filePath);
    
    // Notify user
    await createStorageNotification(
      post.author_id,
      'storage_fallback',
      'File Migrated to P2P Network',
      `Your track "${post.title}" has been automatically moved to the decentralized P2P storage due to server capacity limits. It will still be accessible for playback.`,
      { fileSize: post.file_size, storageType: 'hybrid' }
    );
    
    return { success: true, postId, cid: uploadResult.cid };
    
  } catch (error) {
    console.error('Failed to migrate file to P2P:', error);
    return { 
      success: false, 
      postId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Balance server storage by migrating old files to P2P
 * Ensures system never runs out of storage by aggressively migrating when needed
 */
export async function balanceServerStorage(
  requiredFreeSpace: number = 0
): Promise<{
  migratedCount: number;
  freedSpace: number;
  errors: string[];
  finalUsage: number;
}> {
  const results = {
    migratedCount: 0,
    freedSpace: 0,
    errors: [] as string[],
    finalUsage: 0,
  };
  
  // Get current storage stats
  const stats = await getServerStorageStats();
  
  // Calculate target free space (whichever is larger)
  const targetFreeSpace = Math.max(
    requiredFreeSpace,
    STORAGE_THRESHOLDS.MIN_FREE_SPACE,
    stats.totalSpace * 0.1 // Keep 10% free
  );
  
  // Check if balancing is needed
  const needsBalancing = stats.usagePercentage >= STORAGE_THRESHOLDS.WARNING || 
                          stats.freeSpace < targetFreeSpace;
  
  if (!needsBalancing) {
    console.log(`Storage healthy at ${stats.usagePercentage.toFixed(1)}%, no balancing needed`);
    results.finalUsage = stats.usagePercentage;
    return results;
  }
  
  console.log(`Server storage at ${stats.usagePercentage.toFixed(1)}%, free: ${formatBytes(stats.freeSpace)}`);
  console.log(`Target free space: ${formatBytes(targetFreeSpace)}, starting balance...`);
  
  let freedSpace = 0;
  let migratedCount = 0;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 5;
  
  // Keep migrating until we have enough free space or no more files
  while (freedSpace < targetFreeSpace || stats.usagePercentage >= STORAGE_THRESHOLDS.WARNING) {
    // Get more files if we're running low on space
    const batchSize = stats.usagePercentage >= STORAGE_THRESHOLDS.CRITICAL 
      ? STORAGE_THRESHOLDS.MIGRATION_BATCH_SIZE * 2 
      : STORAGE_THRESHOLDS.MIGRATION_BATCH_SIZE;
    
    const oldestFiles = await getOldestServerFiles(batchSize);
    
    if (oldestFiles.length === 0) {
      console.log('No more files to migrate');
      break;
    }
    
    for (const file of oldestFiles) {
      try {
        const result = await migrateFileToP2P(file.id);
        
        if (result.success) {
          migratedCount++;
          freedSpace += file.fileSize;
          results.freedSpace += file.fileSize;
          consecutiveFailures = 0;
        } else {
          results.errors.push(`Failed to migrate ${file.id}: ${result.error}`);
          consecutiveFailures++;
        }
      } catch (error) {
        results.errors.push(`Error migrating ${file.id}: ${error}`);
        consecutiveFailures++;
      }
      
      // Stop if we've freed enough space
      const newStats = await getServerStorageStats();
      if (newStats.freeSpace >= targetFreeSpace && newStats.usagePercentage < STORAGE_THRESHOLDS.WARNING) {
        console.log(`Storage balanced. Free space: ${formatBytes(newStats.freeSpace)}`);
        results.finalUsage = newStats.usagePercentage;
        return { ...results, migratedCount, freedSpace };
      }
      
      // Stop if too many consecutive failures
      if (consecutiveFailures >= maxConsecutiveFailures) {
        console.error('Too many consecutive migration failures, stopping');
        break;
      }
    }
    
    // Refresh stats for next iteration
    const refreshedStats = await getServerStorageStats();
    
    // Safety limits
    if (migratedCount >= 200) {
      console.log('Migration limit reached (200 files)');
      break;
    }
    
    // If we're still above critical threshold, continue
    if (refreshedStats.usagePercentage < STORAGE_THRESHOLDS.CRITICAL && freedSpace >= targetFreeSpace) {
      break;
    }
  }
  
  results.migratedCount = migratedCount;
  
  // Final stats
  const finalStats = await getServerStorageStats();
  results.finalUsage = finalStats.usagePercentage;
  
  // Notify admin or log results
  if (migratedCount > 0) {
    console.log(`Storage balancing complete: ${migratedCount} files migrated, ${formatBytes(freedSpace)} freed`);
    console.log(`Final usage: ${finalStats.usagePercentage.toFixed(1)}%, Free space: ${formatBytes(finalStats.freeSpace)}`);
  }
  
  return results;
}

/**
 * Emergency storage recovery
 * Called when storage is critically full (>90%)
 * Migrates all server files to P2P except recent ones
 */
export async function emergencyStorageRecovery(): Promise<{
  migratedCount: number;
  freedSpace: number;
  errors: string[];
}> {
  console.log('EMERGENCY: Storage critical, starting emergency recovery...');
  
  const stats = await getServerStorageStats();
  
  if (stats.usagePercentage < 90) {
    console.log('Storage not critical, skipping emergency recovery');
    return { migratedCount: 0, freedSpace: 0, errors: [] };
  }
  
  // Migrate all server files (keep only last 7 days)
  const sql = `
    SELECT 
      p.id,
      p.author_id,
      p.title,
      p.file_size,
      p.created_at,
      p.server_storage_id
    FROM posts p
    WHERE p.storage_type = 'server'
      AND p.server_storage_id IS NOT NULL
      AND p.created_at < NOW() - INTERVAL '7 days'
    ORDER BY p.created_at ASC
  `;
  
  try {
    const result = await query(sql);
    const files = result.rows;
    
    let migratedCount = 0;
    let freedSpace = 0;
    const errors: string[] = [];
    
    for (const file of files) {
      const result = await migrateFileToP2P(file.id);
      if (result.success) {
        migratedCount++;
        freedSpace += parseInt(file.file_size) || 0;
      } else {
        errors.push(`Failed to migrate ${file.id}: ${result.error}`);
      }
    }
    
    console.log(`Emergency recovery complete: ${migratedCount} files migrated, ${formatBytes(freedSpace)} freed`);
    
    return { migratedCount, freedSpace, errors };
  } catch (error) {
    console.error('Emergency recovery failed:', error);
    return { migratedCount: 0, freedSpace: 0, errors: [String(error)] };
  }
}

/**
 * Check storage and balance if needed
 * Can be called periodically or before large uploads
 */
export async function checkAndBalanceStorage(): Promise<{
  balanced: boolean;
  freedSpace: number;
  migratedCount: number;
  finalUsage: number;
}> {
  const stats = await getServerStorageStats();
  
  // Emergency recovery if critical
  if (stats.usagePercentage >= 90) {
    console.log('Storage critical, running emergency recovery...');
    const result = await emergencyStorageRecovery();
    return {
      balanced: true,
      freedSpace: result.freedSpace,
      migratedCount: result.migratedCount,
      finalUsage: (await getServerStorageStats()).usagePercentage,
    };
  }
  
  // Normal balancing if warning threshold reached
  if (stats.usagePercentage >= STORAGE_THRESHOLDS.WARNING) {
    console.log(`Storage threshold reached (${stats.usagePercentage.toFixed(1)}%), balancing...`);
    const result = await balanceServerStorage();
    return {
      balanced: true,
      freedSpace: result.freedSpace,
      migratedCount: result.migratedCount,
      finalUsage: result.finalUsage,
    };
  }
  
  return {
    balanced: false,
    freedSpace: 0,
    migratedCount: 0,
    finalUsage: stats.usagePercentage,
  };
}

/**
 * Enhanced upload function with auto-balancing
 * Ensures there's always enough space for the upload
 */
export async function uploadFileWithBalancing(
  userId: string,
  options: UnifiedUploadOptions
): Promise<StorageResult> {
  const fileSize = options.file.size;
  
  // Check server storage before upload
  const storageStats = await getServerStorageStats();
  
  // Calculate needed space (file size + 10% buffer + min free space)
  const neededSpace = fileSize + (fileSize * 0.1) + STORAGE_THRESHOLDS.MIN_FREE_SPACE;
  
  // Balance if not enough space or above warning threshold
  if (storageStats.freeSpace < neededSpace || storageStats.usagePercentage >= STORAGE_THRESHOLDS.WARNING) {
    console.log(`Server storage at ${storageStats.usagePercentage.toFixed(1)}%, balancing for ${formatBytes(fileSize)} upload...`);
    
    const balanceResult = await balanceServerStorage(neededSpace);
    
    // Check if balancing was sufficient
    const newStats = await getServerStorageStats();
    if (newStats.freeSpace < neededSpace && newStats.usagePercentage >= 90) {
      // Emergency - still not enough space, try emergency recovery
      await emergencyStorageRecovery();
    }
  }
  
  // Proceed with normal upload
  return uploadFileUnified(userId, options);
}

// ============================================
// Storage Statistics
// ============================================

export interface StorageStats {
  userId: string;
  serverStorageUsed: number;
  p2pStorageUsed: number;
  totalUsed: number;
  dailyUsed: number;
  dailyQuota: number;
  totalQuota: number;
  dailyRemaining: number;
  totalRemaining: number;
  quotaPercentage: number;
  storageBreakdown: {
    server: { count: number; size: number };
    p2p: { count: number; size: number };
  };
}

/**
 * Get comprehensive storage statistics for a user
 */
export async function getStorageStats(userId: string): Promise<StorageStats | null> {
  const quota = await getUserQuota(userId);
  if (!quota) {
    return null;
  }

  // Get file counts by storage type
  const countsResult = await query(
    `SELECT 
      storage_type,
      COUNT(*) as count,
      SUM(file_size) as total_size
    FROM posts 
    WHERE author_id = $1 
    GROUP BY storage_type`,
    [userId]
  );

  const serverCount = countsResult.rows.find((r: any) => r.storage_type === 'server')?.count || 0;
  const serverSize = parseInt(countsResult.rows.find((r: any) => r.storage_type === 'server')?.total_size) || 0;
  const p2pCount = countsResult.rows.filter((r: any) => ['ipfs', 'hybrid'].includes(r.storage_type)).reduce((acc: number, r: any) => acc + parseInt(r.count), 0);
  const p2pSize = countsResult.rows.filter((r: any) => ['ipfs', 'hybrid'].includes(r.storage_type)).reduce((acc: number, r: any) => acc + parseInt(r.total_size || 0), 0);

  return {
    userId,
    serverStorageUsed: quota.serverStorageUsed,
    p2pStorageUsed: quota.p2pStorageUsed,
    totalUsed: quota.totalUsed,
    dailyUsed: quota.dailyUsed,
    dailyQuota: quota.dailyQuota,
    totalQuota: quota.totalQuota,
    dailyRemaining: quota.dailyQuota - quota.dailyUsed,
    totalRemaining: quota.totalQuota - quota.totalUsed,
    quotaPercentage: (quota.totalUsed / quota.totalQuota) * 100,
    storageBreakdown: {
      server: { count: serverCount, size: serverSize },
      p2p: { count: p2pCount, size: p2pSize },
    },
  };
}

export default {
  // Quota management
  getUserQuota,
  checkUserQuota,
  updateUserStorageUsage,

  // Server storage
  storeOnServer,
  retrieveFromServer,
  deleteFromServer,

  // P2P storage
  storeOnP2P,

  // Unified interface
  uploadFileUnified,
  retrieveFileUnified,
  deleteFileUnified,

  // Statistics
  getStorageStats,

  // Constants
  FILE_TYPES,
  DEFAULT_DAILY_QUOTA,
  DEFAULT_TOTAL_QUOTA,
};
