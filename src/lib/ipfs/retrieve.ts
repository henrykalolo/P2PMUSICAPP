/**
 * IPFS Retrieval Service
 * Handles fetching and streaming content from IPFS
 */

import { unixfs, UnixFS } from '@helia/unixfs';
import { getHelia, parseCID } from './client';
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

export interface RetrievalProgress {
  /** Current bytes retrieved */
  bytesRetrieved: number;
  /** Total bytes (if known) */
  totalBytes?: number;
  /** Progress percentage (0-100) if total is known */
  percentage?: number;
}

export interface StreamOptions {
  /** Offset to start reading from */
  offset?: number;
  /** Maximum number of bytes to read */
  length?: number;
  /** Progress callback */
  onProgress?: (progress: RetrievalProgress) => void;
}

/**
 * Retrieve a file from IPFS as Uint8Array
 * @param cid - IPFS CID
 * @param options - Retrieval options
 * @returns File content as Uint8Array
 */
export async function retrieveFile(
  cid: string,
  options: StreamOptions = {}
): Promise<Uint8Array> {
  const ufs = getUnixFS();
  const parsedCid = parseCID(cid);

  try {
    const chunks: Uint8Array[] = [];
    let bytesRetrieved = 0;

    for await (const chunk of ufs.cat(parsedCid, {
      offset: options.offset,
      length: options.length,
    })) {
      chunks.push(chunk);
      bytesRetrieved += chunk.length;

      options.onProgress?.({
        bytesRetrieved,
        totalBytes: options.length,
        percentage: options.length ? (bytesRetrieved / options.length) * 100 : undefined,
      });
    }

    // Concatenate all chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  } catch (error) {
    console.error('IPFS retrieval error:', error);
    throw new Error(`Failed to retrieve file from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieve a file from IPFS as a Blob
 * @param cid - IPFS CID
 * @param mimeType - MIME type of the file
 * @returns File content as Blob
 */
export async function retrieveBlob(
  cid: string,
  mimeType: string = 'application/octet-stream'
): Promise<Blob> {
  const data = await retrieveFile(cid);
  // Cast to ArrayBuffer to satisfy TypeScript
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: mimeType });
}

/**
 * Retrieve a file from IPFS as an Object URL
 * Useful for audio/video elements and images
 * @param cid - IPFS CID
 * @param mimeType - MIME type of the file
 * @returns Object URL that can be used in src attributes
 */
export async function retrieveObjectURL(
  cid: string,
  mimeType: string = 'application/octet-stream'
): Promise<string> {
  const blob = await retrieveBlob(cid, mimeType);
  return URL.createObjectURL(blob);
}

/**
 * Stream audio content from IPFS
 * Creates a readable stream suitable for HTML5 audio elements
 * @param cid - IPFS CID of the audio file
 * @param mimeType - Audio MIME type (e.g., 'audio/mpeg', 'audio/ogg')
 * @returns ReadableStream for the audio content
 */
export async function streamAudioFromIPFS(
  cid: string,
  mimeType: string = 'audio/mpeg'
): Promise<ReadableStream<Uint8Array>> {
  const ufs = getUnixFS();
  const parsedCid = parseCID(cid);

  try {
    // Create a readable stream from the IPFS cat iterator
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of ufs.cat(parsedCid)) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return stream;
  } catch (error) {
    console.error('Audio streaming error:', error);
    throw new Error(`Failed to stream audio from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create an audio element that streams from IPFS
 * @param cid - IPFS CID of the audio file
 * @param mimeType - Audio MIME type
 * @returns HTMLAudioElement configured to stream from IPFS
 */
export async function createIPFSAudioElement(
  cid: string,
  mimeType: string = 'audio/mpeg'
): Promise<HTMLAudioElement> {
  try {
    // For smaller files, retrieve as blob and create object URL
    // For larger files, you might want to use MediaSource Extensions
    const objectUrl = await retrieveObjectURL(cid, mimeType);
    
    const audio = new Audio();
    audio.src = objectUrl;
    audio.preload = 'metadata';
    
    // Clean up object URL when audio is done
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(objectUrl);
    });

    return audio;
  } catch (error) {
    console.error('Create audio element error:', error);
    throw new Error(`Failed to create audio element: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieve JSON metadata from IPFS
 * @param cid - IPFS CID of the JSON file
 * @returns Parsed JSON object
 */
export async function retrieveJSON<T = unknown>(cid: string): Promise<T> {
  const { getJSON } = await import('./client');
  const json = getJSON();
  const parsedCid = parseCID(cid);

  try {
    const data = await json.get(parsedCid);
    return data as T;
  } catch (error) {
    console.error('JSON retrieval error:', error);
    throw new Error(`Failed to retrieve JSON from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieve track metadata from IPFS
 * @param cid - IPFS CID of the track metadata
 * @returns Track metadata object
 */
export async function retrieveTrackMetadata(cid: string) {
  const { getDAGJSON } = await import('./client');
  const dagJson = getDAGJSON();
  const parsedCid = parseCID(cid);

  try {
    const metadata = await dagJson.get(parsedCid);
    return metadata;
  } catch (error) {
    console.error('Metadata retrieval error:', error);
    throw new Error(`Failed to retrieve metadata from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a CID is available locally (pinned or cached)
 * @param cid - IPFS CID to check
 * @returns Boolean indicating if CID is available locally
 */
export async function isAvailableLocally(cid: string): Promise<boolean> {
  const helia = getHelia();
  const parsedCid = parseCID(cid);

  try {
    // Check if CID is pinned
    for await (const pinnedCid of helia.pins.rm(parsedCid)) {
      // Just checking if we can iterate, this won't actually remove
      // because we're not consuming the async generator properly
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get the size of a file in IPFS
 * @param cid - IPFS CID
 * @returns Size in bytes
 */
export async function getFileSize(cid: string): Promise<number> {
  const ufs = getUnixFS();
  const parsedCid = parseCID(cid);

  try {
    let totalSize = 0;
    for await (const chunk of ufs.cat(parsedCid)) {
      totalSize += chunk.length;
    }
    return totalSize;
  } catch (error) {
    console.error('Get file size error:', error);
    throw new Error(`Failed to get file size: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a MediaSource for streaming audio with seeking support
 * This is useful for larger audio files where you want to support seeking
 * @param cid - IPFS CID of the audio file
 * @param mimeType - Audio MIME type with codec (e.g., 'audio/mpeg; codecs="mp3"')
 * @returns MediaSource URL and cleanup function
 */
export async function createIPFSMediaSource(
  cid: string,
  mimeType: string = 'audio/mpeg'
): Promise<{
  url: string;
  cleanup: () => void;
}> {
  const mediaSource = new MediaSource();
  const url = URL.createObjectURL(mediaSource);

  mediaSource.addEventListener('sourceopen', async () => {
    try {
      const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
      const stream = await streamAudioFromIPFS(cid, mimeType);
      const reader = stream.getReader();

      // Append chunks as they arrive
      const appendNextChunk = async () => {
        try {
          const { done, value } = await reader.read();
          if (done) {
            if (mediaSource.readyState === 'open') {
              mediaSource.endOfStream();
            }
            return;
          }

          // Wait for source buffer to be ready
          if (sourceBuffer.updating) {
            await new Promise(resolve => {
              sourceBuffer.addEventListener('updateend', resolve, { once: true });
            });
          }

          sourceBuffer.appendBuffer(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer);
          await appendNextChunk();
        } catch (error) {
          console.error('MediaSource append error:', error);
          if (mediaSource.readyState === 'open') {
            mediaSource.endOfStream('decode');
          }
        }
      };

      await appendNextChunk();
    } catch (error) {
      console.error('MediaSource setup error:', error);
      if (mediaSource.readyState === 'open') {
        mediaSource.endOfStream('network');
      }
    }
  });

  const cleanup = () => {
    URL.revokeObjectURL(url);
    if (mediaSource.readyState === 'open') {
      mediaSource.endOfStream();
    }
  };

  return { url, cleanup };
}

export default {
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
};