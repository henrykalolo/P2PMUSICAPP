import { describe, expect, it } from 'vitest';
import {
  createPublicFileUrl,
  isAllowedImageUrl,
  isUuid,
  parsePublicFileUrl,
} from './public-url';

const USER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const FILE_ID = '9f8c7b6a-5544-4332-b210-0fedcba98765';

describe('public image URL helpers', () => {
  it('creates a canonical avatar URL', () => {
    const url = createPublicFileUrl(USER_ID, FILE_ID);
    expect(url).toBe(`/api/storage/public?userId=${USER_ID}&id=${FILE_ID}`);
    expect(parsePublicFileUrl(url)).toEqual({
      userId: USER_ID,
      fileId: FILE_ID,
      fileType: 'avatar',
    });
  });

  it('creates a cover art URL with an explicit file type', () => {
    const url = createPublicFileUrl(USER_ID, FILE_ID, 'coverArt');
    expect(url).toContain('fileType=coverArt');
    expect(parsePublicFileUrl(url)?.fileType).toBe('coverArt');
  });

  it('rejects malformed or unsafe references', () => {
    expect(parsePublicFileUrl('/api/storage/public?userId=bad&id=bad')).toBeNull();
    expect(parsePublicFileUrl('/api/storage/public?userId=../etc&id=x')).toBeNull();
    expect(
      parsePublicFileUrl(
        `/api/storage/public?userId=${USER_ID}&id=${FILE_ID}&fileType=audio`
      )
    ).toBeNull();
    expect(isUuid('not-a-uuid')).toBe(false);
  });

  it('allows only safe image URL shapes for profile fields', () => {
    expect(isAllowedImageUrl(createPublicFileUrl(USER_ID, FILE_ID))).toBe(true);
    expect(isAllowedImageUrl('https://cdn.example.com/avatar.png')).toBe(true);
    expect(isAllowedImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isAllowedImageUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedImageUrl('http://cdn.example.com/avatar.png')).toBe(false);
    expect(isAllowedImageUrl('/api/storage/download?userId=x')).toBe(false);
  });
});
