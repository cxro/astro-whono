import { describe, expect, it } from 'vitest';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import {
  createProjectMarkdownRehypePlugins,
  createProjectMarkdownRemarkPlugins
} from '../src/plugins/markdown-pipeline.mjs';
import { renderAdminMarkdownPreview } from '../src/lib/admin-console/preview';

// 公开渲染走 Astro 真实处理器，后台预览走 preview.ts，两条链路都要覆盖。
const renderPublic = async (source: string): Promise<string> => {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    remarkPlugins: createProjectMarkdownRemarkPlugins(),
    rehypePlugins: createProjectMarkdownRehypePlugins()
  });
  return (await processor.render(source)).code;
};

const renderPreview = async (source: string): Promise<string> =>
  (await renderAdminMarkdownPreview({ collection: 'essay', source })).html;

const renderers = [
  ['public', renderPublic],
  ['preview', renderPreview]
] as const;

describe.each(renderers)('markdown content syntax (%s)', (_name, render) => {
  it('keeps colon text that remark-directive mistakes for a text directive', async () => {
    const html = await render('会议 10:30 开始，比例 a:b，见 Note:this，访问 localhost:4321/x。');

    expect(html).toBe('<p>会议 10:30 开始，比例 a:b，见 Note:this，访问 localhost:4321/x。</p>');
  });

  it('keeps the label and attributes of an unknown text directive as written', async () => {
    const html = await render('前缀 foo:bar[**x**]{a=1} 后缀');

    expect(html).toBe('<p>前缀 foo:bar[**x**]{a=1} 后缀</p>');
  });
});
