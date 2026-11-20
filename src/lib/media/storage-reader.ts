/**
 * Range-aware reader for stored media.
 *
 * Works for both legacy plaintext files and new chunk-encrypted files. Only
 * the encrypted chunks covering the requested plaintext range are read.
 */

import { open } from 'fs/promises';
import { stat } from 'fs/promises';
import {
  resolveServerFilePath,
  readEncryptionMeta,
} from '@/lib/storage/unifiedStorage';
import {
  decryptRange,
  plaintextSizeFromCiphertext,
  PLAINTEXT_CHUNK_SIZE,
  ENCRYPTED_CHUNK_SIZE,
} from '@/lib/storage/file-crypto';
import { parseRangeHeader, type MediaRange } from './range';

export { parseRangeHeader, type MediaRange };

export interface MediaSlice {
  data: Buffer;
  total: number;
}

export async function readMediaRange(
  userId: string,
  fileId: string,
  fileType: string,
  start: number,
  end: number
): Promise<MediaSlice> {
  const filePath = resolveServerFilePath(userId, fileId, fileType);
  const meta = await readEncryptionMeta(userId, fileId, fileType);
  const handle = await open(filePath, 'r');

  try {
    const fileSize = (await stat(filePath)).size;

    if (fileSize === 0) {
      return { data: Buffer.alloc(0), total: 0 };
    }

    if (!meta) {
      const safeStart = Math.max(0, Math.min(start, fileSize - 1));
      const safeEnd = Math.max(safeStart, Math.min(end, fileSize - 1));
      const length = safeEnd - safeStart + 1;
      const data = Buffer.alloc(length);
      const { bytesRead } = await handle.read(data, 0, length, safeStart);
      return { data: data.subarray(0, bytesRead), total: fileSize };
    }

    const iv = Buffer.from(meta.iv, 'hex');
    if (iv.length !== 12) throw new Error('Invalid encryption metadata');
    const total = meta.size > 0 ? meta.size : plaintextSizeFromCiphertext(fileSize);
    const safeStart = Math.max(0, Math.min(start, total - 1));
    const safeEnd = Math.max(safeStart, Math.min(end, total - 1));

    const firstChunk = Math.floor(safeStart / PLAINTEXT_CHUNK_SIZE);
    const lastChunk = Math.floor(safeEnd / PLAINTEXT_CHUNK_SIZE);
    const cipherStart = firstChunk * ENCRYPTED_CHUNK_SIZE;
    const cipherEnd = Math.min(fileSize, (lastChunk + 1) * ENCRYPTED_CHUNK_SIZE);
    const cipherData = Buffer.alloc(cipherEnd - cipherStart);
    const { bytesRead } = await handle.read(cipherData, 0, cipherData.length, cipherStart);

    const data = decryptRange(
      cipherData.subarray(0, bytesRead),
      iv,
      total,
      safeStart,
      safeEnd,
      firstChunk
    );
    return { data, total };
  } finally {
    await handle.close();
  }
}
