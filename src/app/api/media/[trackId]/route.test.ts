import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TRACK_ID = '123e4567-e89b-42d3-a456-426614174000';
const USER_ID = '223e4567-e89b-42d3-a456-426614174000';
const STORAGE_ID = '323e4567-e89b-42d3-a456-426614174000';

const { queryMock, readMediaRangeMock, verifyMediaTokenMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  readMediaRangeMock: vi.fn(),
  verifyMediaTokenMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ query: queryMock }));
vi.mock('@/lib/auth/jwt', () => ({ verifyToken: vi.fn() }));
vi.mock('@/lib/media/signed-url', async () => {
  const actual = await vi.importActual<typeof import('@/lib/media/signed-url')>(
    '@/lib/media/signed-url'
  );
  return { ...actual, verifyMediaToken: verifyMediaTokenMock };
});
vi.mock('@/lib/media/storage-reader', async () => {
  const actual = await vi.importActual<typeof import('@/lib/media/storage-reader')>(
    '@/lib/media/storage-reader'
  );
  return { ...actual, readMediaRange: readMediaRangeMock };
});

import { GET } from './route';

const context = { params: Promise.resolve({ trackId: TRACK_ID }) };

function makeRequest(range?: string) {
  return new NextRequest(`http://localhost/api/media/${TRACK_ID}?token=valid`, {
    headers: range ? { range } : {},
  });
}

function trackRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TRACK_ID,
    author_id: USER_ID,
    storage_type: 'server',
    server_storage_id: STORAGE_ID,
    file_size: 10,
    mime_type: 'audio/mpeg',
    ipfs_gateway_url: null,
    ipfs_cid: null,
    ...overrides,
  };
}

describe('GET /api/media/:trackId', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'x'.repeat(64);
    verifyMediaTokenMock.mockReset().mockReturnValue(true);
    queryMock.mockReset().mockResolvedValue({ rows: [trackRow()] });
    readMediaRangeMock
      .mockReset()
      .mockResolvedValue({ data: Buffer.from('0123456789'), total: 10 });
  });

  it('serves a range from the server copy with 206 headers', async () => {
    readMediaRangeMock.mockResolvedValue({ data: Buffer.from('234'), total: 10 });

    const response = await GET(makeRequest('bytes=2-4'), context);

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 2-4/10');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(await response.text()).toBe('234');
    expect(readMediaRangeMock).toHaveBeenCalledWith(USER_ID, STORAGE_ID, 'audio', 2, 4);
  });

  it('rejects an unsatisfiable range with 416', async () => {
    const response = await GET(makeRequest('bytes=20-30'), context);

    expect(response.status).toBe(416);
    expect(response.headers.get('content-range')).toBe('bytes */10');
    expect(readMediaRangeMock).not.toHaveBeenCalled();
  });

  it('redirects IPFS-only tracks when no server copy exists', async () => {
    queryMock.mockResolvedValue({
      rows: [trackRow({
        storage_type: 'ipfs',
        server_storage_id: null,
        ipfs_gateway_url: 'https://gateway.example/ipfs/cid',
        ipfs_cid: 'cid',
      })],
    });

    const response = await GET(makeRequest(), context);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://gateway.example/ipfs/cid');
    expect(readMediaRangeMock).not.toHaveBeenCalled();
  });

  it('falls back to IPFS when a stale server id points to a missing file', async () => {
    queryMock.mockResolvedValue({
      rows: [trackRow({
        storage_type: 'hybrid',
        ipfs_gateway_url: 'https://gateway.example/ipfs/cid',
        ipfs_cid: 'cid',
      })],
    });
    readMediaRangeMock.mockRejectedValue(new Error('ENOENT'));

    const response = await GET(makeRequest(), context);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://gateway.example/ipfs/cid');
  });
});
