/**
 * Crypto Web Worker for P2P Music Platform
 * Offloads heavy cryptographic and P2P operations to prevent UI blocking
 */

// Types
interface CryptoMessage {
  type: 'DECRYPT_CHUNK' | 'VERIFY_HASH' | 'DERIVE_KEY' | 'ENCRYPT_CHUNK';
  payload: any;
  requestId: string;
}

interface CryptoResponse {
  type: string;
  requestId: string;
  result?: any;
  error?: string;
}

// Handle messages from main thread
self.addEventListener('message', async (event: MessageEvent) => {
  const { type, payload, requestId } = event.data as CryptoMessage;

  try {
    let result: any;

    switch (type) {
      case 'DECRYPT_CHUNK':
        result = await decryptChunk(
          payload.encryptedData,
          payload.key,
          payload.iv
        );
        self.postMessage({
          type: 'DECRYPT_COMPLETE',
          requestId,
          result,
        } as CryptoResponse);
        break;

      case 'VERIFY_HASH':
        result = await verifyChunkHash(
          payload.chunkData,
          payload.expectedHash
        );
        self.postMessage({
          type: 'VERIFY_COMPLETE',
          requestId,
          result,
        } as CryptoResponse);
        break;

      case 'DERIVE_KEY':
        result = await deriveGroupKey(
          payload.sharedSecret,
          payload.salt
        );
        self.postMessage({
          type: 'DERIVE_COMPLETE',
          requestId,
          result,
        } as CryptoResponse);
        break;

      case 'ENCRYPT_CHUNK':
        result = await encryptChunk(
          payload.data,
          payload.key
        );
        self.postMessage({
          type: 'ENCRYPT_COMPLETE',
          requestId,
          result,
        } as CryptoResponse);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'CRYPTO_ERROR',
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    } as CryptoResponse);
  }
});

/**
 * Decrypt a chunk of data
 */
async function decryptChunk(
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as ArrayBuffer,
      tagLength: 128,
    },
    key,
    encryptedData
  );
}

/**
 * Encrypt a chunk of data
 */
async function encryptChunk(
  data: ArrayBuffer,
  key: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    key,
    data
  );

  return { encrypted, iv };
}

/**
 * Verify chunk hash
 */
async function verifyChunkHash(
  chunkData: ArrayBuffer,
  expectedHash: string
): Promise<boolean> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', chunkData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hashHex === expectedHash;
}

/**
 * Derive group key from shared secret
 */
async function deriveGroupKey(
  sharedSecret: ArrayBuffer,
  salt: Uint8Array
): Promise<CryptoKey> {
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as unknown as ArrayBuffer,
      info: new TextEncoder().encode('music-platform-v1'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Notify that worker is ready
self.postMessage({ type: 'WORKER_READY' });
