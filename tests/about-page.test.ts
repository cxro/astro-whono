import { describe, expect, it } from 'vitest';
import {
  normalizeAboutFriendApplyHref,
  normalizeAboutFriendAvatarSource,
  normalizeAboutFriendUrl,
  resolveAboutFriendApply,
  resolveAboutFriends
} from '../src/lib/about-page';

describe('about page helpers', () => {
  it('normalizes friend URLs and external apply links', () => {
    expect(normalizeAboutFriendUrl(' https://example.com/friend ')).toBe('https://example.com/friend');
    expect(normalizeAboutFriendUrl('http://example.com/friend')).toBe('http://example.com/friend');
    expect(normalizeAboutFriendUrl('mailto:hello@example.com')).toBeNull();
    expect(normalizeAboutFriendUrl('javascript:alert(1)')).toBeNull();

    expect(normalizeAboutFriendApplyHref('mailto:hello@example.com?subject=友链申请')).toBe(
      'mailto:hello@example.com?subject=友链申请'
    );
    expect(normalizeAboutFriendApplyHref('https://example.com/apply')).toBe('https://example.com/apply');
    expect(normalizeAboutFriendApplyHref('javascript:alert(1)')).toBeNull();
    expect(normalizeAboutFriendApplyHref('mailto:hello@example.com\r\nbcc:bad@example.com')).toBeNull();
  });

  it('normalizes friend avatar sources without changing bits avatar rules', () => {
    expect(normalizeAboutFriendAvatarSource(' ./friends/alice.webp ')).toBe('friends/alice.webp');
    expect(normalizeAboutFriendAvatarSource('https://example.com/avatar.webp')).toBe(
      'https://example.com/avatar.webp'
    );
    expect(normalizeAboutFriendAvatarSource('http://example.com/avatar.webp')).toBeNull();
    expect(normalizeAboutFriendAvatarSource('/friends/alice.webp')).toBeNull();
    expect(normalizeAboutFriendAvatarSource('public/friends/alice.webp')).toBeNull();
    expect(normalizeAboutFriendAvatarSource('friends/alice.webp?v=2')).toBeNull();
  });

  it('resolves optional friend apply links only when label and href are both valid', () => {
    expect(resolveAboutFriendApply({ label: ' 申请友链 ', href: 'https://example.com/apply' })).toEqual({
      label: '申请友链',
      href: 'https://example.com/apply'
    });
    expect(resolveAboutFriendApply({ label: '申请友链' })).toBeNull();
    expect(resolveAboutFriendApply({ href: 'https://example.com/apply' })).toBeNull();
    expect(resolveAboutFriendApply({ label: '申请友链', href: 'javascript:alert(1)' })).toBeNull();
  });

  it('filters invisible friends and keeps order sorting stable', () => {
    expect(
      resolveAboutFriends(
        [
          { name: 'No order A', url: 'https://example.com/a' },
          { name: 'Hidden', url: 'https://example.com/hidden', visible: false, order: 0 },
          { name: 'Order 2', url: 'https://example.com/2', order: 2 },
          { name: 'Order 1 A', url: 'https://example.com/1-a', order: 1, avatar: 'friends/a.webp' },
          { name: 'Order 1 B', url: 'https://example.com/1-b', order: 1 },
          { name: 'No order B', url: 'https://example.com/b' }
        ],
        '/blog/'
      )
    ).toEqual([
      {
        name: 'Order 1 A',
        url: 'https://example.com/1-a',
        description: '',
        avatarSrc: '/blog/friends/a.webp'
      },
      {
        name: 'Order 1 B',
        url: 'https://example.com/1-b',
        description: '',
        avatarSrc: ''
      },
      {
        name: 'Order 2',
        url: 'https://example.com/2',
        description: '',
        avatarSrc: ''
      },
      {
        name: 'No order A',
        url: 'https://example.com/a',
        description: '',
        avatarSrc: ''
      },
      {
        name: 'No order B',
        url: 'https://example.com/b',
        description: '',
        avatarSrc: ''
      }
    ]);
  });
});
