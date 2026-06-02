import { describe, expect, it } from 'vitest';
import {
  BITS_CARD_FULL_RENDER_LIMIT,
  buildBitsCardViewModel,
  deriveBitsCardText
} from '../src/lib/bits-card-view-model';

describe('bits card view model', () => {
  it('shares the 180-character full-render rule with bits cards', () => {
    expect(deriveBitsCardText('短内容 **Markdown**').shouldRenderFull).toBe(true);
    expect(deriveBitsCardText('a'.repeat(BITS_CARD_FULL_RENDER_LIMIT + 1))).toMatchObject({
      shouldRenderFull: false,
      excerpt: `${'a'.repeat(BITS_CARD_FULL_RENDER_LIMIT)}…`
    });
  });

  it('derives author, tags, date and media for preview cards', () => {
    const viewModel = buildBitsCardViewModel({
      id: 'demo-bit',
      slug: 'demo',
      bodyText: 'Hello',
      tags: ['loc:Shanghai', 'daily'],
      date: new Date(2026, 4, 27, 8, 30),
      images: [
        { src: 'bits/a.webp', width: '800', height: 600, alt: 'A' },
        { src: 'https://example.com/b.webp', width: 'bad', height: '0' }
      ],
      author: { name: 'Alice', avatar: 'author/alice.webp' },
      defaultAuthor: { name: 'Whono', avatar: 'author/default.webp' },
      base: '/blog/'
    });

    expect(viewModel.slug).toBe('demo');
    expect(viewModel.authorName).toBe('Alice');
    expect(viewModel.authorAvatar).toBe('/blog/author/alice.webp');
    expect(viewModel.placeText).toBe('Shanghai');
    expect(viewModel.normalTagItems).toEqual(['#daily']);
    expect(viewModel.dateLabel).toBe('2026-05-27 08:30');
    expect(viewModel.imageItems).toEqual([
      { src: '/blog/bits/a.webp', width: 800, height: 600, alt: 'A' },
      { src: 'https://example.com/b.webp', alt: '' }
    ]);
  });

  it('uses the default author avatar when the editor author avatar is empty', () => {
    const viewModel = buildBitsCardViewModel({
      id: 'demo-bit',
      bodyText: 'Hello',
      author: { name: '', avatar: '' },
      defaultAuthor: { name: 'Whono', avatar: 'author/default.webp' },
      base: '/blog/'
    });

    expect(viewModel.authorName).toBe('Whono');
    expect(viewModel.authorAvatar).toBe('/blog/author/default.webp');
  });
});
