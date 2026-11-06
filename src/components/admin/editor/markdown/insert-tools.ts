import type { MarkdownInsertPlacement, MarkdownToolId } from './markdown-tools';

const MARKDOWN_MORE_SEPARATOR_TEXT = '<!-- more -->';

export type MarkdownMathInsertTool = {
  type: 'math';
  id: Extract<MarkdownToolId, 'inlineMath' | 'blockMath'>;
  label: string;
  icon: 'sigma' | 'square-sigma';
};

export type MarkdownDetailsInsertTool = {
  type: 'details';
  id: Extract<MarkdownToolId, 'details'>;
  label: string;
  icon: 'list-collapse';
  text: string;
  placement: Extract<MarkdownInsertPlacement, 'block'>;
};

export type MarkdownMoreSeparatorInsertTool = {
  type: 'moreSeparator';
  label: string;
  icon: 'separator-horizontal';
  text: string;
  placement: Extract<MarkdownInsertPlacement, 'block'>;
};

export type MarkdownAboutDirectiveInsertTool = {
  type: 'aboutDirective';
  id: 'friend' | 'faq' | 'siteInfo' | 'contactLinks';
  label: string;
  icon: 'square-user-round' | 'badge-question-mark' | 'info' | 'link-2';
  text: string;
  placement: Extract<MarkdownInsertPlacement, 'block'>;
};

export const MARKDOWN_DETAILS_SUMMARY_PLACEHOLDER = '标题';
export const MARKDOWN_DETAILS_BODY_PLACEHOLDER = '内容';

// 正文已有 `:::` 行（嵌套提示块或代码块里的示例）时加长外层围栏，否则外层会在第一个 `:::` 处提前结束。
export const getMarkdownDirectiveFence = (body: string): string => {
  const longest = Math.max(0, ...Array.from(body.matchAll(/^[ \t]*(:{3,})/gm), (match) => match[1]?.length ?? 0));
  return ':'.repeat(Math.max(3, longest + 1));
};

export const buildMarkdownDetailsText = (
  body: string = MARKDOWN_DETAILS_BODY_PLACEHOLDER
): string => {
  const fence = getMarkdownDirectiveFence(body);
  return [`${fence}details[${MARKDOWN_DETAILS_SUMMARY_PLACEHOLDER}]`, body, fence].join('\n');
};

export const MARKDOWN_MATH_INSERT_TOOLS: readonly MarkdownMathInsertTool[] = [
  { type: 'math', id: 'inlineMath', label: '行内公式', icon: 'sigma' },
  { type: 'math', id: 'blockMath', label: '块级公式', icon: 'square-sigma' }
] as const;

export const MARKDOWN_DETAILS_INSERT_TOOL: MarkdownDetailsInsertTool = {
  type: 'details',
  id: 'details',
  label: '折叠内容',
  icon: 'list-collapse',
  text: buildMarkdownDetailsText(),
  placement: 'block'
};

export const MARKDOWN_MORE_SEPARATOR_INSERT_TOOL: MarkdownMoreSeparatorInsertTool = {
  type: 'moreSeparator',
  label: '摘要分隔',
  icon: 'separator-horizontal',
  text: MARKDOWN_MORE_SEPARATOR_TEXT,
  placement: 'block'
};

export const MARKDOWN_ABOUT_DIRECTIVE_INSERT_TOOLS: readonly MarkdownAboutDirectiveInsertTool[] = [
  {
    type: 'aboutDirective',
    id: 'friend',
    label: '插入友链',
    icon: 'square-user-round',
    text: [
      ':::friend{name="站点名称" url="https://example.com" avatar="https://example.com/avatar.png"}',
      '一句介绍',
      ':::'
    ].join('\n'),
    placement: 'block'
  },
  {
    type: 'aboutDirective',
    id: 'faq',
    label: '插入问答',
    icon: 'badge-question-mark',
    text: [
      ':::faq{question="问题标题"}',
      '回答内容',
      ':::'
    ].join('\n'),
    placement: 'block'
  },
  {
    type: 'aboutDirective',
    id: 'siteInfo',
    label: '插入本站资料',
    icon: 'info',
    text: '::site-info{name="站点名称" url="https://example.com" description="一句介绍" avatar="https://example.com/avatar.png"}',
    placement: 'block'
  },
  {
    type: 'aboutDirective',
    id: 'contactLinks',
    label: '插入联系方式',
    icon: 'link-2',
    text: '::contact-links',
    placement: 'block'
  }
] as const;
