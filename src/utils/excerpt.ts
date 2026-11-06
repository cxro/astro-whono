const MORE_REGEX = /<!--\s*more\s*-->/i;

// 模糊内容不进入摘要、meta description 与搜索索引。块未闭合（如被 <!-- more --> 截断）时一直遮到结尾。
const HIDDEN_TEXT_PLACEHOLDER = '[隐藏内容]';
const SPOILER_BLOCK_RE = /^[ \t]*(:{3,})spoiler\b[^\n]*\n[\s\S]*?(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gm;
const SPOILER_INLINE_RE = /:spoiler\[(?:[^[\]\\]|\\.|\[[^[\]]*\])+\](?:\{[^}\n]*\})?/g;
// `:::note[标题]`、`:::details[问题]{open}` 等指令围栏行只保留标题。
const DIRECTIVE_FENCE_RE = /^[ \t]*:{3,}[ \t]*[\w-]*(?:\[([^\]\n]*)\])?(?:\{[^}\n]*\})?[ \t]*$/gm;
// 与 src/plugins/remark-mark.mjs 的配对规则一致：两侧紧贴英文字母或数字时不算高亮。
const HIGHLIGHT_RE = /(?<![A-Za-z0-9=])==(?=[^\s=])([\s\S]*?[^\s=])==(?![A-Za-z0-9=])/g;

export type DerivedMarkdownText = {
  plainText: string;
  excerptText: string;
};

export function splitMore(md: string): string {
  if (!md) return '';
  const match = md.match(MORE_REGEX);
  if (!match) return md;
  const index = match.index ?? -1;
  return index >= 0 ? md.slice(0, index) : md;
}

export function cleanMarkdownToText(md: string): string {
  if (!md) return '';
  let text = md;

  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/~~~[\s\S]*?~~~/g, ' ');

  text = text.replace(/^\s*#{1,6}\s+/gm, '');
  text = text.replace(/^\s*>\s?/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+[\.\)]\s+/gm, '');

  // 先去掉行首前缀（引用里的模糊块才能匹配），再在链接替换之前遮住模糊内容（否则链接会吃掉 `[`）。
  text = text.replace(SPOILER_BLOCK_RE, HIDDEN_TEXT_PLACEHOLDER);
  text = text.replace(SPOILER_INLINE_RE, HIDDEN_TEXT_PLACEHOLDER);

  text = text.replace(/!\[[^\]]*]\([^)]+\)/g, ' ');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/`[^`]*`/g, ' ');

  text = text.replace(DIRECTIVE_FENCE_RE, (_match, label: string | undefined) => label ?? '');
  text = text.replace(HIGHLIGHT_RE, '$1');

  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\r?\n+/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export function truncateText(text: string, maxChars = 120): string {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars))}…`;
}

export function deriveMarkdownText(md: string): DerivedMarkdownText {
  if (!md) {
    return {
      plainText: '',
      excerptText: ''
    };
  }

  const excerptMarkdown = splitMore(md);
  const plainText = cleanMarkdownToText(md);

  return {
    plainText,
    excerptText: excerptMarkdown === md ? plainText : cleanMarkdownToText(excerptMarkdown)
  };
}
