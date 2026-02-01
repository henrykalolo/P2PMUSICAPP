/**
 * P2P Module - Main exports for P2P functionality
 */

// WebTorrent integration
export {
  initWebTorrent,
  getWebTorrentClient,
  isWebTorrentSupported,
  seedFile,
  streamAudio,
  getTorrentInfo,
  removeTorrent,
  getAllTorrents,
  pauseAll,
  resumeAll,
  destroyWebTorrent,
  createMagnetLink,
  parseMagnetLink,
  type TorrentInfo,
  type SeedingOptions,
  type StreamCallbacks,
} from './webtorrent';

// Crypto utilities
export {
  generateEncryptionKey,
  importKey,
  encryptTrack,
  decryptTrack,
  deriveGroupKey,
  keyToString,
  stringToKey,
  generateSalt,
  saltToString,
  stringToSalt,
  type EncryptedData,
  type EncryptionKey,
} from './crypto';

// Legacy P2P Audio Player
export {
  P2PAudioPlayer,
  type TorrentInfo as PlayerTorrentInfo,
} from './player';

// Default export
export { default } from './webtorrent';
