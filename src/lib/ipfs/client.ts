/**
 * IPFS Client Configuration and Initialization
 * Uses Helia for IPFS operations in the browser
 */

import { createHelia, Helia } from 'helia';
import { dagJson, DAGJSON } from '@helia/dag-json';
import { json, JSON } from '@helia/json';
import { strings, Strings } from '@helia/strings';
import { CID } from 'multiformats/cid';

// Singleton instance
let heliaInstance: Helia | null = null;
let dagJsonInstance: DAGJSON | null = null;
let jsonInstance: JSON | null = null;
let stringsInstance: Strings | null = null;

export interface IPFSConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Custom bootstrap nodes */
  bootstrapNodes?: string[];
  /** Enable pubsub */
  pubsub?: boolean;
  /** Custom libp2p config */
  libp2pConfig?: any;
}

const DEFAULT_BOOTSTRAP_NODES = [
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
];

/**
 * Initialize the Helia IPFS client
 * This creates a singleton instance that can be reused
 */
export async function initIPFS(config: IPFSConfig = {}): Promise<Helia> {
  if (heliaInstance) {
    return heliaInstance;
  }

  const bootstrapNodes = config.bootstrapNodes || DEFAULT_BOOTSTRAP_NODES;

  try {
    // Dynamic imports for libp2p modules
    const [{ webRTC }, { webSockets }, { webTransport }, { noise }, { mplex }, { yamux }, { bootstrap }, { identify }, { kadDHT }] = await Promise.all([
      import('@libp2p/webrtc'),
      import('@libp2p/websockets'),
      import('@libp2p/webtransport'),
      import('@libp2p/noise'),
      import('@libp2p/mplex'),
      import('@libp2p/yamux'),
      import('@libp2p/bootstrap'),
      import('@libp2p/identify'),
      import('@libp2p/kad-dht'),
    ]);

    const libp2pOptions: any = {
      transports: [
        webRTC(),
        webSockets(),
        webTransport(),
      ],
      connectionEncryption: [
        noise(),
      ],
      streamMuxers: [
        mplex(),
        yamux(),
      ],
      peerDiscovery: [
        bootstrap({
          list: bootstrapNodes,
        }),
      ],
      services: {
        identify: identify(),
        dht: kadDHT(),
      },
      ...config.libp2pConfig,
    };



    heliaInstance = await createHelia({
      libp2p: libp2pOptions,
    });

    // Initialize helper modules
    dagJsonInstance = dagJson(heliaInstance as any);
    jsonInstance = json(heliaInstance as any);
    stringsInstance = strings(heliaInstance as any);

    if (config.debug) {
      console.log('IPFS Helia initialized');
      console.log('Peer ID:', heliaInstance.libp2p.peerId.toString());
    }

    return heliaInstance;
  } catch (error) {
    console.error('Failed to initialize IPFS:', error);
    throw error;
  }
}

/**
 * Get the existing Helia instance or throw if not initialized
 */
export function getHelia(): Helia {
  if (!heliaInstance) {
    throw new Error('IPFS not initialized. Call initIPFS() first.');
  }
  return heliaInstance;
}

/**
 * Get the DAG JSON instance
 */
export function getDAGJSON(): DAGJSON {
  if (!dagJsonInstance) {
    throw new Error('IPFS not initialized. Call initIPFS() first.');
  }
  return dagJsonInstance;
}

/**
 * Get the JSON instance
 */
export function getJSON(): JSON {
  if (!jsonInstance) {
    throw new Error('IPFS not initialized. Call initIPFS() first.');
  }
  return jsonInstance;
}

/**
 * Get the strings instance
 */
export function getStrings(): Strings {
  if (!stringsInstance) {
    throw new Error('IPFS not initialized. Call initIPFS() first.');
  }
  return stringsInstance;
}

/**
 * Stop the IPFS node and cleanup
 */
export async function stopIPFS(): Promise<void> {
  if (heliaInstance) {
    await heliaInstance.stop();
    heliaInstance = null;
    dagJsonInstance = null;
    jsonInstance = null;
    stringsInstance = null;
    console.log('IPFS stopped');
  }
}

/**
 * Check if IPFS is supported in the current environment
 */
export function isIPFSSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    'RTCPeerConnection' in window &&
    'WebSocket' in window &&
    'crypto' in window &&
    'subtle' in window.crypto
  );
}

/**
 * Parse a CID string to CID object
 */
export function parseCID(cidString: string): CID {
  return CID.parse(cidString);
}

/**
 * Check if a string is a valid CID
 */
export function isValidCID(cidString: string): boolean {
  try {
    CID.parse(cidString);
    return true;
  } catch {
    return false;
  }
}

export default {
  initIPFS,
  getHelia,
  getDAGJSON,
  getJSON,
  getStrings,
  stopIPFS,
  isIPFSSupported,
  parseCID,
  isValidCID,
};