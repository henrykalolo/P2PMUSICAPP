/**
 * Storage Module - Main exports for unified storage functionality
 */

// Unified storage service
export {
  uploadFileUnified,
  uploadFileWithBalancing,
  retrieveFileUnified,
  deleteFileUnified,
  getStorageStats,
  checkUserQuota,
  updateUserStorageUsage,
  storeOnServer,
  retrieveFromServer,
  deleteFromServer,
  storeOnP2P,
  // Server storage management
  getServerStorageStats,
  getOldestServerFiles,
  migrateFileToP2P,
  balanceServerStorage,
  checkAndBalanceStorage,
  emergencyStorageRecovery,
  STORAGE_THRESHOLDS,
  type UserQuota,
  type QuotaCheckResult,
  type ServerStorageResult,
  type P2PStorageResult,
  type StorageResult,
  type UnifiedUploadOptions,
  type StorageStats,
  type NotificationType,
  type StorageNotification,
  // Notification functions
  createStorageNotification,
  notifyQuotaWarning,
  notifyQuotaExceeded,
  notifyStorageFallback,
  notifyStorageSuccess,
  FILE_TYPES,
  DEFAULT_DAILY_QUOTA,
  DEFAULT_TOTAL_QUOTA,
  StorageSystem,
} from './unifiedStorage';
