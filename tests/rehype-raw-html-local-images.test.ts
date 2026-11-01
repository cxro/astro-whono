import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import rehypeRaw from 'rehype-raw';
import { createPublicMarkdownConfig } from '../src/plugins/markdown-pipeline.mjs';
import { rehypeRawHtmlLocalImages } from '../src/plugins/rehype-raw-html-local-images.mjs';

// Uses Astro's real processor so a change to its image collection contract fails here.
const render = async (source: string, withPath = true) => {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    rehypePlugins: [rehypeRaw, rehypeRawHtmlLocalImages]
  });
  return processor.render(source, withPath ? { fileURL: pathToFileURL(path.resolve('src/content/essay/post.md')) } : {});
};

const gallery = (src: string) =>
  ['<ul class="gallery">', '  <li>', '    <figure>', `      <img src="${src}" alt="g" />`, '    </figure>', '  </li>', '</ul>'].join('\n');

describe('rehype raw html local images', () => {
  it('registers relative raw html images for Astro image processing', async () => {
    const { code, metadata } = await render(gallery('./post/photo%201.webp'));

    expect(metadata.localImagePaths).toEqual(['./post/photo 1.webp']);
    expect(code).toContain('__ASTRO_IMAGE_');
    expect(code).not.toContain('src="./post/photo%201.webp"');
  });

  it('merges with markdown image paths without duplicates', async () => {
    const { metadata } = await render(['![md](./a.webp)', '', gallery('./a.webp'), '', gallery('b.png')].join('\n'));

    expect(metadata.localImagePaths).toEqual(['./a.webp', 'b.png']);
  });

  it('leaves public, remote and data images untouched', async () => {
    const source = [gallery('/images/a.webp'), gallery('https://example.com/a.webp'), gallery('data:image/png;base64,AAAA')].join('\n\n');
    const { code, metadata } = await render(source);

    expect(metadata.localImagePaths).toEqual([]);
    expect(code).not.toContain('__ASTRO_IMAGE_');
  });

  it('registers gallery images through the full public markdown pipeline', async () => {
    const renderer = await createPublicMarkdownConfig().processor.createRenderer({ syntaxHighlight: false });
    const { code, metadata } = await renderer.render(gallery('./post/photo.webp'), {
      fileURL: pathToFileURL(path.resolve('src/content/essay/post.md'))
    });

    expect(metadata.localImagePaths).toEqual(['./post/photo.webp']);
    expect(code).toContain('__ASTRO_IMAGE_');
    expect(code).toContain('class="gallery"');
  });

  it('skips files without a path like Astro image collection does', async () => {
    const { code } = await render(gallery('./a.webp'), false);

    expect(code).not.toContain('__ASTRO_IMAGE_');
  });
});
