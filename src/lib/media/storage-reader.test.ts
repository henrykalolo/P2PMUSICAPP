import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const FILE_ID = '22222222-2222-4222-8222-222222222222';

describe('readMediaRange', () => {
  let dir: string;
  let plaintext: Buffer;
  let cryptoModule: typeof import('@/lib/storage/file-crypto');
  let reader: typeof import('@/lib/media/storage-reader');

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'p2pmusic-reader-'));
    process.env.STORAGE_DIR = dir;
    process.env.ENCRYPTION_MASTER_KEY = 'c'.repeat(64);
    vi.resetModules();

    cryptoModule = await import('@/lib/storage/file-crypto');
    reader = await import('@/lib/media/storage-reader');

    plaintext = Buffer.alloc(cryptoModule.PLAINTEXT_CHUNK_SIZE + 200);
    for (let i = 0; i < plaintext.length; i++) plaintext[i] = i % 257;

    const encrypted = cryptoModule.encryptForStorage(plaintext);
    const trackDir = path.join(dir, 'users', USER_ID, 'tracks');
    await mkdir(trackDir, { recursive: true });
    const filePath = path.join(trackDir, `${FILE_ID}.mp3`);
    await writeFile(filePath, encrypted.data);
    await writeFile(
      `${filePath}.enc.json`,
      JSON.stringify({
        iv: encrypted.iv.toString('hex'),
        size: plaintext.length,
        alg: 'aes-256-gcm',
      })
    );
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns the full plaintext with its size', async () => {
    const result = await reader.readMediaRange(USER_ID, FILE_ID, 'audio', 0, plaintext.length - 1);
    expect(result.total).toBe(plaintext.length);
    expect(result.data.equals(plaintext)).toBe(true);
  });

  it('decrypts only the requested cross-chunk range', async () => {
    const start = cryptoModule.PLAINTEXT_CHUNK_SIZE - 10;
    const end = cryptoModule.PLAINTEXT_CHUNK_SIZE + 20;
    const result = await reader.readMediaRange(USER_ID, FILE_ID, 'audio', start, end);
    expect(result.total).toBe(plaintext.length);
    expect(result.data.equals(plaintext.subarray(start, end + 1))).toBe(true);
  });
});
