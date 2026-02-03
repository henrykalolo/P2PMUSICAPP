import { describe, it, expect } from 'vitest';
import { cn, formatDuration, formatFileSize } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('should combine class names', () => {
      expect(cn('base', 'active')).toBe('base active');
    });

    it('should handle conditional classes', () => {
      expect(cn('base', true && 'conditional')).toBe('base conditional');
      expect(cn('base', false && 'conditional')).toBe('base');
    });

    it('should handle objects', () => {
      expect(cn('base', { active: true, disabled: false })).toBe('base active');
    });

    it('should handle arrays', () => {
      expect(cn(['base', 'active'])).toBe('base active');
    });

    it('should merge tailwind classes', () => {
      expect(cn('p-2 p-4', 'm-2 m-4')).toBe('p-4 m-4');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds', () => {
      expect(formatDuration(30)).toBe('0:30');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(125)).toBe('2:05');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0:00');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500.00 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(2048)).toBe('2.00 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1.00 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1.00 GB');
    });

    it('should handle zero', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });
  });
});
