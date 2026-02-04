/**
 * WebTorrent Integration for P2P Music Streaming
 * Provides torrent creation, streaming, and seeding capabilities
 */

// Import global shim FIRST - this must be before any webtorrent imports
import './global-shim';

// @ts-ignore - Global polyfill for browser environment
import WebTorrent from 'webtorrent';
import type { Torrent, TorrentFile } from 'webtorrent';

// Singleton instance
let client: InstanceType<typeof WebTorrent> | null = null;

export interface TorrentInfo {
  infoHash: string;
  magnetURI: string;
  numPeers: number;
  progress: number;
  done: boolean;
  downloadSpeed: number;
  uploadSpeed: number;
}

export interface SeedingOptions {
  name?: string;
  announce?: string[];
  comment?: string;
  createdBy?: string;
  creationDate?: Date;
}

export interface StreamCallbacks {
  onProgress?: (progress: number) => void;
  onPeerConnect?: (numPeers: number) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
}

/**
 * Initialize the WebTorrent client
 */
export function initWebTorrent(): InstanceType<typeof WebTorrent> {
  if (client) {
    return client;
  }

  client = new WebTorrent({
    tracker: {
      ws: true,
      rtcConfig: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          {
            urls: process.env.NEXT_PUBLIC_TURN_SERVER || 'turn:turn.example.com:3478',
            username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'user',
            credential: process.env.NEXT_PUBLIC_TURN_PASSWORD || 'pass'
          }
        ]
      }
    },
    dht: false,
    webSeeds: true
  });

  client.on('error', (err: Error) => {
    console.error('WebTorrent client error:', err);
  });

  return client;
}

/**
 * Get the existing WebTorrent client or initialize a new one
 */
export function getWebTorrentClient(): InstanceType<typeof WebTorrent> {
  if (!client) {
    return initWebTorrent();
  }
  return client;
}

/**
 * Check if WebTorrent is supported in the current browser
 */
export function isWebTorrentSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'RTCPeerConnection' in window &&
    'WebSocket' in window
  );
}

/**
 * Create a torrent from a file and start seeding
 * @param file - The file to seed
 * @param options - Seeding options
 * @returns Promise with torrent info
 */
export async function seedFile(
  file: File,
  options: SeedingOptions = {}
): Promise<TorrentInfo> {
  const wt = getWebTorrentClient();

  return new Promise((resolve, reject) => {
    const fileOptions = {
      name: options.name || file.name,
      announce: options.announce || [
        'wss://tracker.openwebtorrent.com',
        'wss://tracker.files.fm:7073/announce',
        'wss://spacetradersapi-chatbox.herokuapp.com:443/announce'
      ],
      comment: options.comment,
      createdBy: options.createdBy || 'P2P Music Platform',
      creationDate: options.creationDate
    };

    wt.seed(file, fileOptions, (torrent: Torrent) => {
      console.log('Seeding torrent:', torrent.infoHash);
      console.log('Magnet URI:', torrent.magnetURI);

      resolve({
        infoHash: torrent.infoHash,
        magnetURI: torrent.magnetURI,
        numPeers: torrent.numPeers,
        progress: torrent.progress,
        done: torrent.done,
        downloadSpeed: torrent.downloadSpeed,
        uploadSpeed: torrent.uploadSpeed
      });
    });

    wt.on('error', (err: Error) => {
      reject(err);
    });
  });
}

/**
 * Stream audio from a magnet URI
 * @param magnetURI - The magnet link to stream
 * @param callbacks - Optional callbacks for progress and events
 * @returns Promise with audio element and torrent info
 */
export async function streamAudio(
  magnetURI: string,
  callbacks?: StreamCallbacks
): Promise<{
  audioElement: HTMLAudioElement;
  torrent: Torrent;
  file: TorrentFile;
}> {
  const wt = getWebTorrentClient();

  return new Promise((resolve, reject) => {
    wt.add(magnetURI, {
      sequential: true,
      strategy: 'rarest'
    }, (torrent: Torrent) => {
      // Find the audio file
      const audioFile = torrent.files.find((f: TorrentFile) =>
        ['.mp3', '.ogg', '.m4a', '.flac', '.wav'].some(ext =>
          f.name.toLowerCase().endsWith(ext)
        )
      );

      if (!audioFile) {
        reject(new Error('No audio file found in torrent'));
        return;
      }

      // Set up event listeners
      torrent.on('download', () => {
        callbacks?.onProgress?.(Math.round(torrent.progress * 100));
      });

      torrent.on('wire', () => {
        callbacks?.onPeerConnect?.(torrent.numPeers);
      });

      torrent.on('done', () => {
        callbacks?.onDone?.();
      });

      torrent.on('error', (err: Error) => {
        callbacks?.onError?.(err);
      });

      // Create audio element
      const audioElement = document.createElement('audio');
      audioElement.controls = true;
      audioElement.preload = 'auto';

      // Render to audio element
      audioFile.renderTo(audioElement, {
        autoplay: false,
        controls: true
      });

      resolve({
        audioElement,
        torrent,
        file: audioFile
      });
    });

    wt.on('error', (err: Error) => {
      reject(err);
    });
  });
}

/**
 * Get current torrent info by infoHash
 * @param infoHash - The torrent info hash
 * @returns Torrent info or null if not found
 */
export function getTorrentInfo(infoHash: string): TorrentInfo | null {
  if (!client) return null;

  const torrent = client.get(infoHash);
  if (!torrent) return null;

  return {
    infoHash: torrent.infoHash,
    magnetURI: torrent.magnetURI,
    numPeers: torrent.numPeers,
    progress: torrent.progress,
    done: torrent.done,
    downloadSpeed: torrent.downloadSpeed,
    uploadSpeed: torrent.uploadSpeed
  };
}

/**
 * Remove a torrent from the client
 * @param infoHash - The torrent info hash to remove
 * @param removeData - Whether to remove downloaded data
 */
export function removeTorrent(infoHash: string, removeData: boolean = false): void {
  if (!client) return;
  client.remove(infoHash, { destroyStore: removeData });
}

/**
 * Get all active torrents
 * @returns Array of torrent info
 */
export function getAllTorrents(): TorrentInfo[] {
  if (!client) return [];

  return client.torrents.map((torrent: Torrent) => ({
    infoHash: torrent.infoHash,
    magnetURI: torrent.magnetURI,
    numPeers: torrent.numPeers,
    progress: torrent.progress,
    done: torrent.done,
    downloadSpeed: torrent.downloadSpeed,
    uploadSpeed: torrent.uploadSpeed
  }));
}

/**
 * Pause all torrents (stop announcing but keep connections)
 */
export function pauseAll(): void {
  if (!client) return;
  client.torrents.forEach((torrent: Torrent) => {
    torrent.pause();
  });
}

/**
 * Resume all paused torrents
 */
export function resumeAll(): void {
  if (!client) return;
  client.torrents.forEach((torrent: Torrent) => {
    torrent.resume();
  });
}

/**
 * Destroy the WebTorrent client and cleanup all resources
 */
export function destroyWebTorrent(): void {
  if (client) {
    client.destroy();
    client = null;
  }
}

/**
 * Create a magnet link with encryption key
 * @param infoHash - The torrent info hash
 * @param name - The torrent name
 * @param encryptionKey - Optional encryption key to include
 * @returns Magnet URI string
 */
export function createMagnetLink(
  infoHash: string,
  name: string,
  encryptionKey?: string
): string {
  const trackers = [
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.files.fm:7073/announce'
  ];

  let magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}`;
  
  trackers.forEach(tracker => {
    magnet += `&tr=${encodeURIComponent(tracker)}`;
  });

  if (encryptionKey) {
    magnet += `&xk=${encodeURIComponent(encryptionKey)}`;
  }

  return magnet;
}

/**
 * Parse a magnet link to extract components
 * @param magnetURI - The magnet link to parse
 * @returns Parsed magnet components
 */
export function parseMagnetLink(magnetURI: string): {
  infoHash: string | null;
  name: string | null;
  trackers: string[];
  encryptionKey: string | null;
} {
  const url = new URL(magnetURI);
  const params = new URLSearchParams(url.search);

  const xt = params.get('xt');
  const infoHash = xt?.startsWith('urn:btih:') ? xt.slice(9) : null;
  
  return {
    infoHash,
    name: params.get('dn'),
    trackers: params.getAll('tr'),
    encryptionKey: params.get('xk')
  };
}

export default {
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
  parseMagnetLink
};
