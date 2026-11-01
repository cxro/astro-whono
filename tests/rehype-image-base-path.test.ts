import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPublicMarkdownConfig } from '../src/plugins/markdown-pipeline.mjs';

const render = async (source: string, base: string) => {
  const renderer = await createPublicMarkdownConfig({ base }).processor.createRenderer({ syntaxHighlight: false });
  const { code } = await renderer.render(source, { fileURL: pathToFileURL(path.resolve('src/content/essay/post.md')) });
  return code;
};

const srcs = (html: string) => Array.from(html.matchAll(/<img[^>]*?\ssrc="([^"]*)"/g), (match) => match[1]);

describe('rehype image base path', () => {
  it('prefixes root-relative raw html and markdown images with the deployment base', async () => {
    const html = await render(['<img src="/images/a.webp" alt="a" />', '', '![b](/images/b.webp)'].join('\n'), '/blog/');

    expect(srcs(html)).toEqual(['/blog/images/a.webp', '/blog/images/b.webp']);
  });

  it('keeps paths already under the base, protocol-relative and remote images', async () => {
    const html = await render(
      [
        '<img src="/blog/images/a.webp" alt="a" />',
        '<img src="//cdn.example.com/b.webp" alt="b" />',
        '<img src="https://example.com/c.webp" alt="c" />',
        '<img src="/blog-assets/d.webp" alt="d" />'
      ].join('\n'),
      '/blog'
    );

    expect(srcs(html)).toEqual([
      '/blog/images/a.webp',
      '//cdn.example.com/b.webp',
      'https://example.com/c.webp',
      '/blog/blog-assets/d.webp'
    ]);
  });

  it('prefixes picture source srcset candidates and keeps descriptors', async () => {
    const html = await render(
      [
        '<picture>',
        '<source srcset="/images/a.webp 1x, /images/a@2x.webp 2x, https://example.com/a.webp 3x" type="image/webp" />',
        '<img src="/images/a.png" alt="a" />',
        '</picture>'
      ].join('\n'),
      '/blog/'
    );

    expect(html).toContain(
      'srcset="/blog/images/a.webp 1x, /blog/images/a@2x.webp 2x, https://example.com/a.webp 3x"'
    );
    expect(srcs(html)).toEqual(['/blog/images/a.png']);
  });

  it('leaves root deployments unchanged', async () => {
    const html = await render('<img src="/images/a.webp" alt="a" />', '/');

    expect(srcs(html)).toEqual(['/images/a.webp']);
  });
});
