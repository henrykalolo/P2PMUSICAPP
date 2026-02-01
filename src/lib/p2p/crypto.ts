/**
 * Encryption utilities for P2P music platform
 * Uses Web Crypto API for AES-256-GCM encryption
 */

export interface EncryptedData {
  encrypted: ArrayBuffer;
  iv: Uint8Array;
}

export interface EncryptionKey {
  key: CryptoKey;
  exportedKey: JsonWebKey;
}

/**
 * Generates a new AES-256-GCM encryption key
 */
export async function generateEncryptionKey(): Promise<EncryptionKey> {
  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedKey = await window.crypto.subtle.exportKey('jwk', key);

  return { key, exportedKey };
}

/**
 * Imports a JWK key for encryption/decryption
 */
export async function importKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts audio content using AES-256-GCM
 */
export async function encryptTrack(
  fileBuffer: ArrayBuffer,
  key: CryptoKey
): Promise<EncryptedData> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128
    },
    key,
    fileBuffer
  );

  return { encrypted, iv };
}

/**
 * Decrypts audio content using AES-256-GCM
 */
export async function decryptTrack(
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128
    },
    key,
    encryptedData
  );
}

/**
 * Derives a group key from social relationship using X25519
 */
export async function deriveGroupKey(
  userPrivateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  salt: Uint8Array
): Promise<CryptoKey> {
  const sharedSecret = await window.crypto.subtle.deriveBits(
    {
      name: 'X25519',
      public: peerPublicKey
    },
    userPrivateKey,
    256
  );

  const hkdfKey = await window.crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: new TextEncoder().encode('music-platform-v1')
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates a key string for sharing in magnet links
 */
export function keyToString(jwk: JsonWebKey): string {
  return btoa(JSON.stringify(jwk));
}

/**
 * Parses a key string from magnet links
 */
export function stringToKey(keyString: string): JsonWebKey {
  return JSON.parse(atob(keyString));
}

/**
 * Generates a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Converts salt to base64 string
 */
export function saltToString(salt: Uint8Array): string {
  return btoa(String.fromCharCode(...salt));
}

/**
 * Converts base64 string to salt
 */
export function stringToSalt(saltString: string): Uint8Array {
  const charCodes = atob(saltString).split('').map(c => c.charCodeAt(0));
  return new Uint8Array(charCodes);
}
