import { describe, expect, it } from 'vitest';
import {
  getAdminNavOrderIssues,
  getAdminSocialOrderIssues,
  normalizeAdminBitsAvatarPath,
  normalizeAdminHeroImageSrc
} from '../src/lib/admin-console/shared';

describe('admin-console/shared', () => {
  it('reports duplicate and range issues for social orders', () => {
    expect(
      getAdminSocialOrderIssues(
        { github: 1, x: 1, email: 99 },
        [{ key: 'custom-1', order: 2 }, { key: 'custom-2', order: 2 }]
      )
    ).toEqual([
      { type: 'duplicate', scope: 'preset', key: 'github', order: 1 },
      { type: 'duplicate', scope: 'preset', key: 'x', order: 1 },
      { type: 'range', scope: 'preset', key: 'email', order: 99 },
      { type: 'duplicate', scope: 'custom', key: 'custom-1', order: 2 },
      { type: 'duplicate', scope: 'custom', key: 'custom-2', order: 2 }
    ]);
  });

  it('reports duplicate and range issues for nav orders', () => {
    expect(
      getAdminNavOrderIssues([
        { key: 'essay', order: 1 },
        { key: 'bits', order: 1 },
        { key: 'memo', order: 0 }
      ])
    ).toEqual([
      { type: 'duplicate', key: 'essay', order: 1 },
      { type: 'duplicate', key: 'bits', order: 1 },
      { type: 'range', key: 'memo', order: 0 }
    ]);
  });

  it('normalizes valid hero image sources and rejects invalid local paths', () => {
    expect(normalizeAdminHeroImageSrc('@/assets/hero/cover.webp')).toBe('src/assets/hero/cover.webp');
    expect(normalizeAdminHeroImageSrc('public/images/hero.png')).toBe('/images/hero.png');
    expect(normalizeAdminHeroImageSrc('https://example.com/hero.avif')).toBe('https://example.com/hero.avif');
    expect(normalizeAdminHeroImageSrc('/images/hero.png?size=2')).toBeUndefined();
    expect(normalizeAdminHeroImageSrc('../hero.png')).toBeUndefined();
  });

  it('normalizes bits avatar paths and rejects invalid values', () => {
    expect(normalizeAdminBitsAvatarPath(' author/avatar.webp ')).toBe('author/avatar.webp');
    expect(normalizeAdminBitsAvatarPath('')).toBe('');
    expect(normalizeAdminBitsAvatarPath('/author/avatar.webp')).toBeUndefined();
    expect(normalizeAdminBitsAvatarPath('public/author/avatar.webp')).toBeUndefined();
    expect(normalizeAdminBitsAvatarPath('https://example.com/avatar.webp')).toBeUndefined();
    expect(normalizeAdminBitsAvatarPath('author/avatar.webp?v=2')).toBeUndefined();
  });
});
