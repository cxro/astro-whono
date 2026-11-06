import { describe, expect, it } from 'vitest';
import { getArticleShareLinks } from '../src/lib/article-share';

describe('article-share', () => {
  const url = 'https://example.com/blog/archive/a-b/?x=1&y=2';
  const title = 'C# & Astro 指南 #1';
  const allPlatforms = ['x', 'facebook', 'weibo', 'telegram', 'linkedin', 'email', 'poster', 'copy'] as const;
  const byId = Object.fromEntries(getArticleShareLinks(url, title, allPlatforms).map((link) => [link.id, link.href]));

  it('keeps the title and url intact through each platform query string', () => {
    const x = new URL(byId.x ?? '');
    expect(x.origin + x.pathname).toBe('https://x.com/intent/tweet');
    expect(x.searchParams.get('text')).toBe(title);
    expect(x.searchParams.get('url')).toBe(url);

    const facebook = new URL(byId.facebook ?? '');
    expect(facebook.origin + facebook.pathname).toBe('https://www.facebook.com/sharer/sharer.php');
    expect(facebook.searchParams.get('u')).toBe(url);

    const weibo = new URL(byId.weibo ?? '');
    expect(weibo.origin + weibo.pathname).toBe('https://service.weibo.com/share/share.php');
    expect(weibo.searchParams.get('url')).toBe(url);
    expect(weibo.searchParams.get('title')).toBe(title);

    const telegram = new URL(byId.telegram ?? '');
    expect(telegram.origin + telegram.pathname).toBe('https://t.me/share/url');
    expect(telegram.searchParams.get('url')).toBe(url);
    expect(telegram.searchParams.get('text')).toBe(title);

    const linkedin = new URL(byId.linkedin ?? '');
    expect(linkedin.origin + linkedin.pathname).toBe('https://www.linkedin.com/sharing/share-offsite/');
    expect(linkedin.searchParams.get('url')).toBe(url);
  });

  it('returns only the chosen platforms and leaves the poster and copy buttons to the page', () => {
    expect(getArticleShareLinks(url, title, ['telegram', 'email', 'poster', 'copy']).map((link) => link.id))
      .toEqual(['telegram', 'email']);
    expect(getArticleShareLinks(url, title, ['poster', 'copy'])).toEqual([]);
    expect(getArticleShareLinks(url, title, [])).toEqual([]);
  });

  it('encodes spaces as %20 in mailto links', () => {
    const email = byId.email ?? '';
    expect(email.startsWith('mailto:?subject=')).toBe(true);
    expect(email).toContain('C%23%20%26%20Astro');
    expect(email).not.toContain('+');
    expect(decodeURIComponent(email.split('&body=')[1] ?? '')).toBe(url);
  });
});
