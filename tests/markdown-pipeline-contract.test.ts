import { describe, expect, it } from 'vitest';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkSmartypants from 'remark-smartypants';
import { rehypeAboutDirectives, remarkAboutDirectives } from '../src/plugins/about-directives.mjs';
import {
  createMarkdownShikiConfig,
  createProjectMarkdownRehypePlugins,
  createProjectMarkdownRemarkPlugins,
  createPublicMarkdownConfig,
  markdownFeatureContract,
  markdownMathOptions,
  markdownRenderingDifferences,
  markdownShikiThemes,
  markdownSmartypantsOptions,
  previewMarkdownRehypeSegments,
  previewMarkdownRemarkSegments,
  publicMarkdownRehypeSegments,
  publicMarkdownRemarkSegments
} from '../src/plugins/markdown-pipeline.mjs';
import {
  markdownMathRawOptions,
  rehypeProtectMarkdownMath,
  rehypeRestoreMarkdownMathBoundary
} from '../src/plugins/rehype-markdown-math-boundary.mjs';
import { sanitizeSchema } from '../src/plugins/sanitize-schema.mjs';

const pluginOf = (entry: unknown) => (Array.isArray(entry) ? entry[0] : entry);
const optionsOf = (entry: unknown) => (Array.isArray(entry) ? entry[1] : undefined);
const previewSegmentIndex = (id: string) =>
  previewMarkdownRehypeSegments.findIndex((segment) => segment.id === id);
const publicSegmentIndex = (id: string) =>
  publicMarkdownRehypeSegments.findIndex((segment) => segment.id === id);

describe('markdown pipeline contract', () => {
  it('declares the shared markdown feature boundaries', () => {
    expect(markdownFeatureContract.map((feature) => feature.id)).toEqual([
      'callout',
      'math',
      'about-directives',
      'code-block',
      'gfm',
      'smartypants',
      'raw-html-sanitize'
    ]);

    expect(markdownFeatureContract.find((feature) => feature.id === 'math')?.options).toEqual({
      singleDollarTextMath: false
    });
    expect(markdownFeatureContract.find((feature) => feature.id === 'code-block')?.shikiThemes).toEqual({
      light: 'github-light',
      dark: 'github-dark'
    });
    expect(markdownFeatureContract.find((feature) => feature.id === 'raw-html-sanitize')).toMatchObject({
      sanitizeSource: 'src/plugins/sanitize-schema.mjs',
      sanitizeStrategy: 'shared-schema',
      perFeatureSchemaMerge: false
    });
  });

  it('keeps Astro public GFM and smartypants as built-ins instead of public remark plugins', () => {
    const publicConfig = createPublicMarkdownConfig({ base: '/blog/' });
    const { options: processorOptions } = publicConfig.processor;
    const publicRemarkPlugins = processorOptions.remarkPlugins.map(pluginOf);

    expect(publicMarkdownRemarkSegments).toEqual([
      {
        id: 'astro-built-in-remark',
        plugins: ['astro-gfm', 'astro-smartypants'],
        before: 'project-remark'
      },
      {
        id: 'project-remark',
        plugins: ['remark-math', 'remark-directive', 'remark-about-directives', 'remark-callout']
      }
    ]);
    expect(publicConfig.processor.name).toBe('unified');
    expect(publicConfig).not.toHaveProperty('remarkPlugins');
    expect(publicConfig).not.toHaveProperty('rehypePlugins');
    expect(processorOptions.gfm).toBeUndefined();
    expect(processorOptions.smartypants).toBeUndefined();
    expect(publicRemarkPlugins).not.toContain(remarkGfm);
    expect(publicRemarkPlugins).not.toContain(remarkSmartypants);
    expect(pluginOf(processorOptions.remarkPlugins[0])).toBe(remarkMath);
    expect(optionsOf(processorOptions.remarkPlugins[0])).toBe(markdownMathOptions);
    expect(optionsOf(processorOptions.rehypePlugins[3])).toEqual({ base: '/blog/' });
  });

  it('documents Astro public rehype order without pretending Shiki is a project rehype plugin', () => {
    expect(publicSegmentIndex('astro-code-highlighting')).toBeLessThan(publicSegmentIndex('project-rehype'));
    expect(publicMarkdownRehypeSegments.find((segment) => segment.id === 'astro-code-highlighting')).toMatchObject({
      provider: 'Astro markdown.shikiConfig',
      excludedLanguages: ['math']
    });
    expect(publicMarkdownRehypeSegments.find((segment) => segment.id === 'project-rehype')).toMatchObject({
      plugins: [
        'rehypeProtectMarkdownMath',
        'rehype-raw',
        'rehypeRestoreMarkdownMathBoundary',
        'rehype-about-directives',
        'rehype-sanitize',
        'rehype-katex'
      ]
    });
  });

  it('declares preview GFM and smartypants before project remark plugins', () => {
    expect(previewMarkdownRemarkSegments.map((segment) => segment.id)).toEqual([
      'preview-parser',
      'preview-astro-built-in-parity',
      'project-remark'
    ]);
    expect(previewMarkdownRemarkSegments[1]).toMatchObject({
      plugins: ['remark-gfm', 'remark-smartypants'],
      before: 'project-remark'
    });
    expect(markdownSmartypantsOptions).toEqual({});
  });

  it('creates shared project remark and rehype plugin entries with explicit about options', () => {
    const remarkPlugins = createProjectMarkdownRemarkPlugins({ aboutEnabled: true });
    const rehypePlugins = createProjectMarkdownRehypePlugins({
      aboutBase: '/blog/',
      aboutEnabled: true
    });

    expect(pluginOf(remarkPlugins[0])).toBe(remarkMath);
    expect(optionsOf(remarkPlugins[0])).toBe(markdownMathOptions);
    expect(pluginOf(remarkPlugins[2])).toBe(remarkAboutDirectives);
    expect(optionsOf(remarkPlugins[2])).toEqual({ enabled: true });

    expect(pluginOf(rehypePlugins[0])).toBe(rehypeProtectMarkdownMath);
    expect(pluginOf(rehypePlugins[1])).toBe(rehypeRaw);
    expect(optionsOf(rehypePlugins[1])).toBe(markdownMathRawOptions);
    expect(pluginOf(rehypePlugins[2])).toBe(rehypeRestoreMarkdownMathBoundary);
    expect(pluginOf(rehypePlugins[3])).toBe(rehypeAboutDirectives);
    expect(optionsOf(rehypePlugins[3])).toEqual({ base: '/blog/', enabled: true });
    expect(pluginOf(rehypePlugins[4])).toBe(rehypeSanitize);
    expect(optionsOf(rehypePlugins[4])).toBe(sanitizeSchema);
    expect(pluginOf(rehypePlugins[5])).toBe(rehypeKatex);
  });

  it('keeps Shiki themes and toolbar transformer in one public factory', () => {
    const shikiConfig = createMarkdownShikiConfig();

    expect(shikiConfig.themes).toEqual(markdownShikiThemes);
    expect(shikiConfig.transformers).toHaveLength(1);
    expect(shikiConfig.transformers[0]?.name).toBe('astro-whono-code-toolbar');
  });

  it('declares the ordered preview rehype segments that the preview adapter must preserve', () => {
    expect(previewSegmentIndex('preview-outline')).toBeLessThan(previewSegmentIndex('math-boundary-protect'));
    expect(previewSegmentIndex('math-boundary-protect')).toBeLessThan(previewSegmentIndex('code-highlighting'));
    expect(previewSegmentIndex('code-highlighting')).toBeLessThan(previewSegmentIndex('raw-html'));
    expect(previewSegmentIndex('raw-html')).toBeLessThan(previewSegmentIndex('sanitize'));
    expect(previewSegmentIndex('preview-local-image-src')).toBeLessThan(previewSegmentIndex('sanitize'));
    expect(previewSegmentIndex('about-directives')).toBeLessThan(previewSegmentIndex('sanitize'));
    expect(previewSegmentIndex('sanitize')).toBeLessThan(previewSegmentIndex('katex'));
    expect(previewSegmentIndex('katex')).toBeLessThan(previewSegmentIndex('preview-stringify'));
  });

  it('documents the sanitize and heading-id strategies as accepted adapter differences', () => {
    expect(markdownRenderingDifferences.sanitize).toEqual({
      source: 'src/plugins/sanitize-schema.mjs',
      strategy: 'shared-schema',
      perFeatureSchemaMerge: false,
      previewOnlyAllowedAttributes: ['data-admin-outline-key']
    });
    expect(markdownRenderingDifferences.headingId).toEqual({
      acceptedDifference: true,
      public: 'Astro generated heading id',
      preview: 'data-admin-outline-key'
    });
  });
});
