/**
 * IPFS Module - Main exports for IPFS functionality
 */

// Client
export {
  initIPFS,
  getHelia,
  getDAGJSON,
  getJSON,
  getStrings,
  stopIPFS,
  isIPFSSupported,
  parseCID,
  isValidCID,
  type IPFSConfig,
} from './client';

// Upload
export {
  uploadFile,
  uploadBrowserFile,
  uploadTrackMetadata,
  uploadTrackPackage,
  getIPFSGatewayUrl,
  getLocalIPFSUrl,
  pinCID,
  unpinCID,
  type UploadProgress,
  type IPFSUploadResult,
  type TrackMetadata,
} from './upload';

// Retrieve
export {
  retrieveFile,
  retrieveBlob,
  retrieveObjectURL,
  streamAudioFromIPFS,
  createIPFSAudioElement,
  retrieveJSON,
  retrieveTrackMetadata,
  isAvailableLocally,
  getFileSize,
  createIPFSMediaSource,
  type RetrievalProgress,
  type StreamOptions,
} from './retrieve';

// Default export
export { default } from './client';