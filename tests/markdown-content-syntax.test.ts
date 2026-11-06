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
    // JS 插件工厂返回的元组推断不出 Astro 的 RehypePlugins 类型。
    rehypePlugins: createProjectMarkdownRehypePlugins() as never
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

  it.each([
    ['这是 ==高亮== 文本', '<p>这是 <mark>高亮</mark> 文本</p>'],
    ['==**粗体** 和 *斜体*== 混排', '<p><mark><strong>粗体</strong> 和 <em>斜体</em></mark> 混排</p>'],
    ['==重点。==后面紧跟中文', '<p><mark>重点。</mark>后面紧跟中文</p>'],
    ['中文==高亮==中文', '<p>中文<mark>高亮</mark>中文</p>'],
    ['会议 ==10:30== 开始', '<p>会议 <mark>10:30</mark> 开始</p>'],
    ['==会议 10:30 开始==', '<p><mark>会议 10:30 开始</mark></p>'],
    ['`a==b` 与 ==真的==', '<p><code>a==b</code> 与 <mark>真的</mark></p>']
  ])('renders highlight %s', async (source, expected) => {
    expect(await render(source)).toBe(expected);
  });

  it.each([
    'a == b 与 a === b',
    '当 a==b 且 c==d 时',
    '==只有开头',
    '== 两侧有空格 =='
  ])('keeps literal equals signs in %s', async (source) => {
    expect(await render(source)).toBe(`<p>${source}</p>`);
  });

  it('renders details directives as native details elements', async () => {
    expect(await render(':::details[问题 **一**]\n答案\n\n- 列表\n:::')).toBe(
      '<details><summary>问题 <strong>一</strong></summary><p>答案</p><ul>\n<li>列表</li>\n</ul></details>'
    );
    expect(await render(':::details[默认展开]{open}\n答案\n:::')).toBe(
      '<details open><summary>默认展开</summary><p>答案</p></details>'
    );
    expect(await render(':::details\n答案\n:::')).toBe('<details><summary>详情</summary><p>答案</p></details>');
  });

  it('renders spoiler directives as focusable blurred elements', async () => {
    const attrs = 'role="button" tabindex="0" aria-label="隐藏内容，点击显示" title="点击显示"';

    expect(await render('结局是 :spoiler[他 **活下来** 了]。')).toBe(
      `<p>结局是 <span class="spoiler" ${attrs}>他 <strong>活下来</strong> 了</span>。</p>`
    );
    expect(await render(':::spoiler\n整段隐藏\n:::')).toBe(
      `<div class="spoiler spoiler--block" ${attrs}><p>整段隐藏</p></div>`
    );
    expect(await render('空标签 :spoiler[] 保持原样')).toBe('<p>空标签 :spoiler[] 保持原样</p>');
  });

  it('keeps other container directives as callouts', async () => {
    expect(await render(':::note[提示]\n内容\n:::')).toBe(
      '<div class="callout note"><p class="callout-title">提示</p><p>内容</p></div>'
    );
  });

  it('highlights inside headings and table cells', async () => {
    expect(await render('### ==标题==')).toContain('<mark>标题</mark></h3>');
    expect(await render('| 列 |\n| --- |\n| ==单元格== |')).toContain('<td><mark>单元格</mark></td>');
  });
});
