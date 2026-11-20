export const PUBLIC_IMAGE_FILE_TYPES = ['avatar', 'coverArt'] as const;
export type PublicImageFileType = (typeof PUBLIC_IMAGE_FILE_TYPES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA_IMAGE_RE = /^data:image\/(jpeg|png|gif|webp);base64,[A-Za-z0-9+/=\s]+$/;
const MAX_INLINE_IMAGE_LENGTH = 2_000_000;

export interface PublicFileReference {
  userId: string;
  fileId: string;
  fileType: PublicImageFileType;
}

export function createPublicFileUrl(
  userId: string,
  fileId: string,
  fileType: PublicImageFileType = 'avatar'
): string {
  const params = new URLSearchParams({ userId, id: fileId });
  if (fileType !== 'avatar') params.set('fileType', fileType);
  return `/api/storage/public?${params.toString()}`;
}

export function parsePublicFileUrl(value: string): PublicFileReference | null {
  try {
    const url = new URL(value, 'http://localhost');
    if (url.pathname !== '/api/storage/public') return null;

    const userId = url.searchParams.get('userId');
    const fileId = url.searchParams.get('id');
    const rawType = url.searchParams.get('fileType') || 'avatar';
    if (!userId || !fileId) return null;
    if (!UUID_RE.test(userId) || !UUID_RE.test(fileId)) return null;
    if (!PUBLIC_IMAGE_FILE_TYPES.includes(rawType as PublicImageFileType)) return null;

    return { userId, fileId, fileType: rawType as PublicImageFileType };
  } catch {
    return null;
  }
}

export function isAllowedImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_INLINE_IMAGE_LENGTH) return false;
  if (parsePublicFileUrl(value)) return true;
  if (/^https:\/\//i.test(value)) return true;
  return DATA_IMAGE_RE.test(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
