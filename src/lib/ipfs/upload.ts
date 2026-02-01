/**
 * IPFS Upload Service
 * Handles adding files and metadata to IPFS
 */

import { unixfs, UnixFS } from '@helia/unixfs';
import { getHelia } from './client';
import { CID } from 'multiformats/cid';

// Singleton instance
let unixfsInstance: UnixFS | null = null;

/**
 * Get or create the UnixFS instance
 */
function getUnixFS(): UnixFS {
  if (!unixfsInstance) {
    const helia = getHelia();
    unixfsInstance = unixfs(helia as any);
  }
  return unixfsInstance;
}

export interface UploadProgress {
  /** Current bytes uploaded */
  bytesUploaded: number;
  /** Total bytes to upload */
  totalBytes: number;
  /** Progress percentage (0-100) */
  percentage: number;
}

export interface IPFSUploadResult {
  /** The CID of the uploaded content */
  cid: string;
  /** Size of the content in bytes */
  size: number;
  /** IPFS path (e.g., /ipfs/Qm...) */
  path: string;
  /** IPFS gateway URL for the content */
  gatewayUrl: string;
}

export interface TrackMetadata {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  year?: number;
  duration?: number;
  description?: string;
  coverArtCid?: string;
  audioCid: string;
  uploadedAt: string;
  uploadedBy: string;
}

/**
 * Upload a file buffer to IPFS
 * @param fileBuffer - The file content as Uint8Array
 * @param options - Upload options
 * @returns Promise with upload result
 */
export async function uploadFile(
  fileBuffer: Uint8Array,
  options: {
    onProgress?: (progress: UploadProgress) => void;
    chunker?: 'fixed' | 'rabin';
    chunkSize?: number;
  } = {}
): Promise<IPFSUploadResult> {
  const ufs = getUnixFS();
  const totalBytes = fileBuffer.length;

  try {
    // Report initial progress
    options.onProgress?.({
      bytesUploaded: 0,
      totalBytes,
      percentage: 0,
    });

    // Add file to IPFS with chunking
    const cid = await ufs.addBytes(fileBuffer, {
      chunker: options.chunker === 'rabin' ? undefined : undefined,
    });

    // Report completion
    options.onProgress?.({
      bytesUploaded: totalBytes,
      totalBytes,
      percentage: 100,
    });

    const cidString = cid.toString();
    const gatewayUrl = getIPFSGatewayUrl(cidString);

    return {
      cid: cidString,
      size: totalBytes,
      path: `/ipfs/${cidString}`,
      gatewayUrl,
    };
  } catch (error) {
    console.error('IPFS upload error:', error);
    throw new Error(`Failed to upload file to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload a File object to IPFS
 * @param file - Browser File object
 * @param options - Upload options
 * @returns Promise with upload result
 */
export async function uploadBrowserFile(
  file: File,
  options: {
    onProgress?: (progress: UploadProgress) => void;
  } = {}
): Promise<IPFSUploadResult> {
  // Convert File to Uint8Array
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  return uploadFile(uint8Array, {
    ...options,
    onProgress: options.onProgress,
  });
}

/**
 * Upload track metadata to IPFS as JSON
 * @param metadata - Track metadata object
 * @returns Promise with upload result
 */
export async function uploadTrackMetadata(
  metadata: TrackMetadata
): Promise<IPFSUploadResult> {
  const { getJSON } = await import('./client');
  const json = getJSON();

  try {
    const cid = await json.add(metadata);
    const cidString = cid.toString();
    const gatewayUrl = getIPFSGatewayUrl(cidString);

    // Estimate size (JSON string length)
    const jsonString = JSON.stringify(metadata);
    const size = new TextEncoder().encode(jsonString).length;

    return {
      cid: cidString,
      size,
      path: `/ipfs/${cidString}`,
      gatewayUrl,
    };
  } catch (error) {
    console.error('Metadata upload error:', error);
    throw new Error(`Failed to upload metadata to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a directory structure for a music track
 * Organizes audio file, cover art, and metadata into a single directory
 * @param audioFile - Audio file content
 * @param metadata - Track metadata
 * @param coverArt - Optional cover art file content
 * @returns Promise with the root directory CID
 */
export async function uploadTrackPackage(
  audioFile: Uint8Array,
  metadata: Omit<TrackMetadata, 'audioCid' | 'coverArtCid'>,
  coverArt?: Uint8Array
): Promise<{
  rootCid: string;
  audioCid: string;
  metadataCid: string;
  coverArtCid?: string;
}> {
  const ufs = getUnixFS();

  try {
    // Upload audio file
    const audioResult = await uploadFile(audioFile);
    
    // Upload cover art if provided
    let coverArtCid: string | undefined;
    if (coverArt) {
      const coverResult = await uploadFile(coverArt);
      coverArtCid = coverResult.cid;
    }

    // Create complete metadata with CIDs
    const completeMetadata: TrackMetadata = {
      ...metadata,
      audioCid: audioResult.cid,
      coverArtCid,
      uploadedAt: new Date().toISOString(),
    };

    // Upload metadata
    const metadataResult = await uploadTrackMetadata(completeMetadata);

    // Create a directory with all components
    // Note: Helia's UnixFS doesn't have a direct mkdir equivalent,
    // so we create a DAG structure
    const directoryEntries = [
      { name: 'audio', cid: CID.parse(audioResult.cid) },
      { name: 'metadata.json', cid: CID.parse(metadataResult.cid) },
    ];

    if (coverArtCid) {
      directoryEntries.push({ name: 'cover', cid: CID.parse(coverArtCid) });
    }

    // For now, return the individual CIDs
    // In a production app, you'd create a proper HAMT-sharded directory
    return {
      rootCid: metadataResult.cid, // Use metadata as root for now
      audioCid: audioResult.cid,
      metadataCid: metadataResult.cid,
      coverArtCid,
    };
  } catch (error) {
    console.error('Track package upload error:', error);
    throw new Error(`Failed to upload track package: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get IPFS gateway URL for a CID
 * @param cid - IPFS CID
 * @param gateway - Gateway URL (defaults to ipfs.io)
 * @returns Full gateway URL
 */
export function getIPFSGatewayUrl(
  cid: string,
  gateway: string = 'https://ipfs.io'
): string {
  return `${gateway}/ipfs/${cid}`;
}

/**
 * Get local IPFS node URL for a CID (if running local node)
 * @param cid - IPFS CID
 * @returns Local gateway URL
 */
export function getLocalIPFSUrl(cid: string): string {
  return `http://localhost:8080/ipfs/${cid}`;
}

/**
 * Pin a CID to ensure it stays available
 * Note: In browser environments, this relies on the Helia node's persistence
 * @param cid - CID to pin
 */
export async function pinCID(cid: string): Promise<void> {
  const helia = getHelia();
  const parsedCid = CID.parse(cid);
  
  try {
    // In Helia, pinning happens automatically when you add content
    // This function can be used to explicitly pin external CIDs
    await helia.pins.add(parsedCid);
  } catch (error) {
    console.error('Pin error:', error);
    throw new Error(`Failed to pin CID: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Unpin a CID
 * @param cid - CID to unpin
 */
export async function unpinCID(cid: string): Promise<void> {
  const helia = getHelia();
  const parsedCid = CID.parse(cid);
  
  try {
    await helia.pins.rm(parsedCid);
  } catch (error) {
    console.error('Unpin error:', error);
    throw new Error(`Failed to unpin CID: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export default {
  uploadFile,
  uploadBrowserFile,
  uploadTrackMetadata,
  uploadTrackPackage,
  getIPFSGatewayUrl,
  getLocalIPFSUrl,
  pinCID,
  unpinCID,
};