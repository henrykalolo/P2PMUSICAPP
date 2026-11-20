import { beforeAll, describe, expect, it } from 'vitest';
import {
  decryptRange,
  encryptForStorage,
  plaintextSizeFromCiphertext,
  PLAINTEXT_CHUNK_SIZE,
  ENCRYPTED_CHUNK_SIZE,
} from './file-crypto';

describe('chunked file encryption', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_MASTER_KEY = 'a'.repeat(64);
  });

  it('round-trips a file spanning multiple chunks', () => {
    const size = PLAINTEXT_CHUNK_SIZE * 2 + 123;
    const plaintext = Buffer.alloc(size);
    for (let i = 0; i < size; i++) plaintext[i] = i % 251;

    const encrypted = encryptForStorage(plaintext);
    expect(encrypted.data.length).toBe(size + 3 * 16);
    expect(plaintextSizeFromCiphertext(encrypted.data.length)).toBe(size);

    const decrypted = decryptRange(encrypted.data, encrypted.iv, size, 0, size - 1);
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it('decrypts only the requested byte range across a chunk boundary', () => {
    const size = PLAINTEXT_CHUNK_SIZE + 100;
    const plaintext = Buffer.alloc(size, 7);
    const encrypted = encryptForStorage(plaintext);
    const start = PLAINTEXT_CHUNK_SIZE - 10;
    const end = PLAINTEXT_CHUNK_SIZE + 20;

    const chunkStart = Math.floor(start / PLAINTEXT_CHUNK_SIZE) * ENCRYPTED_CHUNK_SIZE;
    const chunkEnd = Math.min(
      encrypted.data.length,
      (Math.floor(end / PLAINTEXT_CHUNK_SIZE) + 1) * ENCRYPTED_CHUNK_SIZE
    );
    const slice = encrypted.data.subarray(chunkStart, chunkEnd);

    const decrypted = decryptRange(slice, encrypted.iv, size, start, end);
    expect(decrypted.length).toBe(end - start + 1);
    expect(decrypted.equals(plaintext.subarray(start, end + 1))).toBe(true);
  });

  it('decrypts a range whose ciphertext slice starts at a later chunk', () => {
    const size = PLAINTEXT_CHUNK_SIZE * 2 + 100;
    const plaintext = Buffer.alloc(size, 11);
    const encrypted = encryptForStorage(plaintext);
    const start = PLAINTEXT_CHUNK_SIZE + 25;
    const end = PLAINTEXT_CHUNK_SIZE + 75;
    const firstChunk = Math.floor(start / PLAINTEXT_CHUNK_SIZE);
    const cipherStart = firstChunk * ENCRYPTED_CHUNK_SIZE;
    const cipherEnd = Math.min(encrypted.data.length, cipherStart + ENCRYPTED_CHUNK_SIZE);
    const slice = encrypted.data.subarray(cipherStart, cipherEnd);

    const decrypted = decryptRange(slice, encrypted.iv, size, start, end, firstChunk);
    expect(decrypted.equals(plaintext.subarray(start, end + 1))).toBe(true);
  });

  it('rejects a tampered ciphertext chunk', () => {
    const plaintext = Buffer.from('integrity-checked audio data');
    const encrypted = encryptForStorage(plaintext);
    encrypted.data[0] ^= 0xff;
    expect(() => decryptRange(encrypted.data, encrypted.iv, plaintext.length, 0, plaintext.length - 1)).toThrow();
  });
});
