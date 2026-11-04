import type { MarkdownHeading } from 'astro';

export type ArticleTocItem = MarkdownHeading & {
  // 目录内的相对层级：最浅一级为 1，其下一级为 2；只影响缩进，字体仍按 depth。
  level: 1 | 2;
  // 自动编号（一级 "1."、二级 "1.1"）；文章标题已自带编号或结构不规整时为 null。
  number: string | null;
};

// GFM 脚注区会生成 sr-only 的 H2（id 经 sanitize 加 user-content- 前缀），不属于正文章节。
const FOOTNOTE_LABEL_SLUG = 'user-content-footnote-label';
const MIN_TOC_HEADINGS = 2;

// 标题开头已带编号的常见写法；任一目录项命中即整篇不自动编号，避免出现 "2 1. 背景" 式重复。
// 误判只会让该篇不显示自动编号，不会改写标题文本。
const HEADING_NUMBER_PATTERNS = [
  /^[0-9０-９]+(?:[.．][0-9０-９]+)*[\s.．、)）:：]/u, // 1. / 1.1 / 1、 / 1) / 1 标题（含全角数字）
  /^[(（]\s*(?:[0-9０-９]+|[一二三四五六七八九十百零〇]+)\s*[)）]/u, // (1) / （一）
  /^[一二三四五六七八九十百零〇]+[\s.．、:：]/u, // 一、
  /^第\s*[0-9０-９一二三四五六七八九十百零〇]+\s*[章节部分篇步讲回课]/u, // 第一章 / 第 2 节
  /^[IVXLC]+[.)、]/u, // I. / IV)
  /^[①-⑳❶-❿]/u // ① / ❶
];

export const hasOwnHeadingNumber = (text: string): boolean => {
  const trimmed = text.trim();
  return HEADING_NUMBER_PATTERNS.some((pattern) => pattern.test(trimmed));
};

// 文章目录只收录 H2/H3，保持源顺序与 Astro 生成的 slug；不足两项时不显示目录。
export const getArticleTocHeadings = (headings: readonly MarkdownHeading[]): ArticleTocItem[] => {
  const items = headings.filter(
    (heading) => (heading.depth === 2 || heading.depth === 3) && heading.slug !== FOOTNOTE_LABEL_SLUG
  );
  if (items.length < MIN_TOC_HEADINGS) return [];

  const topDepth = Math.min(...items.map((heading) => heading.depth));
  // 首项不是最浅一级（如 H2 之前先出现 H3）时无法给出无歧义的 x.x 编号，同样整篇不编号。
  const shouldNumber = items[0]?.depth === topDepth && !items.some((heading) => hasOwnHeadingNumber(heading.text));

  let major = 0;
  let minor = 0;
  return items.map((heading) => {
    const level = heading.depth === topDepth ? 1 : 2;
    if (level === 1) {
      major += 1;
      minor = 0;
    } else {
      minor += 1;
    }
    return {
      ...heading,
      level,
      number: shouldNumber ? (level === 1 ? `${major}.` : `${major}.${minor}`) : null
    };
  });
};
