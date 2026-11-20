/**
 * Encryption at rest for stored media.
 *
 * Files are encrypted in fixed-size chunks with AES-256-GCM. Chunk-local IVs
 * are derived from a random per-file base IV, which makes byte-range requests
 * possible: only the requested chunks need to be decrypted.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export const PLAINTEXT_CHUNK_SIZE = 1024 * 1024; // 1 MiB
export const TAG_LENGTH = 16;
export const BASE_IV_LENGTH = 12;
export const ENCRYPTED_CHUNK_SIZE = PLAINTEXT_CHUNK_SIZE + TAG_LENGTH;

function loadMasterKey(): Buffer {
  const hex = process.env.ENCRYPTION_MASTER_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY must be set to a 32-byte key encoded as 64 hex characters.'
    );
  }
  return Buffer.from(hex, 'hex');
}

function chunkIv(baseIv: Buffer, index: number): Buffer {
  if (baseIv.length !== BASE_IV_LENGTH) {
    throw new Error('Invalid base IV length');
  }
  const iv = Buffer.from(baseIv);
  // XOR the last 4 bytes with the chunk index so every chunk has a unique nonce.
  iv[8] ^= (index >>> 24) & 0xff;
  iv[9] ^= (index >>> 16) & 0xff;
  iv[10] ^= (index >>> 8) & 0xff;
  iv[11] ^= index & 0xff;
  return iv;
}

export interface EncryptedFile {
  data: Buffer;
  iv: Buffer;
}

/** Derive the original plaintext size from a chunked ciphertext buffer. */
export function plaintextSizeFromCiphertext(ciphertextSize: number): number {
  if (ciphertextSize === 0) return 0;
  const chunks = Math.ceil(ciphertextSize / ENCRYPTED_CHUNK_SIZE);
  const size = ciphertextSize - chunks * TAG_LENGTH;
  if (size < 0) throw new Error('Invalid encrypted file size');
  return size;
}

/** Encrypt a whole file buffer, returning ciphertext and the per-file base IV. */
export function encryptForStorage(plaintext: Buffer): EncryptedFile {
  const key = loadMasterKey();
  const iv = randomBytes(BASE_IV_LENGTH);
  const parts: Buffer[] = [];

  for (let offset = 0, index = 0; offset < plaintext.length; offset += PLAINTEXT_CHUNK_SIZE, index++) {
    const chunk = plaintext.subarray(offset, Math.min(offset + PLAINTEXT_CHUNK_SIZE, plaintext.length));
    const cipher = createCipheriv('aes-256-gcm', key, chunkIv(iv, index), {
      authTagLength: TAG_LENGTH,
    });
    parts.push(
      cipher.update(chunk),
      cipher.final(),
      cipher.getAuthTag()
    );
  }

  // Empty files still produce an empty ciphertext and a valid IV.
  return { data: Buffer.concat(parts), iv };
}

/**
 * Decrypt a plaintext byte range from an encrypted file.
 *
 * @param data full ciphertext buffer
 * @param iv per-file base IV
 * @param plaintextSize original file size in bytes
 * @param start inclusive plaintext offset
 * @param end inclusive plaintext offset
 * @param baseChunkIndex chunk index at which `data` begins (0 for a full file)
 */
export function decryptRange(
  data: Buffer,
  iv: Buffer,
  plaintextSize: number,
  start: number,
  end: number,
  baseChunkIndex = 0
): Buffer {
  if (plaintextSize <= 0) return Buffer.alloc(0);
  const key = loadMasterKey();
  const from = Math.max(0, Math.min(start, plaintextSize - 1));
  const to = Math.max(from, Math.min(end, plaintextSize - 1));

  const firstChunk = Math.floor(from / PLAINTEXT_CHUNK_SIZE);
  const lastChunk = Math.floor(to / PLAINTEXT_CHUNK_SIZE);
  const output: Buffer[] = [];

  for (let index = firstChunk; index <= lastChunk; index++) {
    const chunkOffset = (index - baseChunkIndex) * ENCRYPTED_CHUNK_SIZE;
    const chunkPlainLength = Math.min(
      PLAINTEXT_CHUNK_SIZE,
      plaintextSize - index * PLAINTEXT_CHUNK_SIZE
    );
    const chunk = data.subarray(chunkOffset, chunkOffset + chunkPlainLength + TAG_LENGTH);
    if (chunk.length !== chunkPlainLength + TAG_LENGTH) {
      throw new Error('Encrypted file is truncated');
    }

    const ciphertext = chunk.subarray(0, chunkPlainLength);
    const authTag = chunk.subarray(chunkPlainLength);
    const decipher = createDecipheriv('aes-256-gcm', key, chunkIv(iv, index), {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    output.push(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
  }

  const merged = Buffer.concat(output);
  const sliceStart = from - firstChunk * PLAINTEXT_CHUNK_SIZE;
  return merged.subarray(sliceStart, sliceStart + (to - from + 1));
}
