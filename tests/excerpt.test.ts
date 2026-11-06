import { describe, expect, it } from 'vitest';
import { cleanMarkdownToText, deriveMarkdownText } from '../src/utils/excerpt';

describe('cleanMarkdownToText content syntax', () => {
  it('replaces spoiler text so it never reaches excerpts or search indexes', () => {
    expect(cleanMarkdownToText('开头 :spoiler[秘密 **内容**] 结束')).toBe('开头 [隐藏内容] 结束');
    expect(cleanMarkdownToText('结局是:spoiler[他活下来了]。')).toBe('结局是[隐藏内容]。');
    expect(cleanMarkdownToText('前文\n\n:::spoiler\n机密段落\n\n第二段\n:::\n\n后文')).toBe('前文 [隐藏内容] 后文');
  });

  it('hides spoilers inside blockquotes and spoilers that contain links', () => {
    expect(cleanMarkdownToText('> :::spoiler\n> 凶手是管家\n> :::\n\n后文')).toBe('[隐藏内容] 后文');
    expect(cleanMarkdownToText('答案:spoiler[见 [这篇文章](https://example.com)]。')).toBe('答案[隐藏内容]。');
  });

  it('keeps an unclosed or cut spoiler block hidden up to the end', () => {
    const source = '前文\n\n:::spoiler\n机密\n<!-- more -->\n更多机密\n:::\n\n后文';

    expect(deriveMarkdownText(source)).toEqual({
      plainText: '前文 [隐藏内容] 后文',
      excerptText: '前文 [隐藏内容]'
    });
  });

  it('keeps directive labels and drops directive fences', () => {
    expect(cleanMarkdownToText(':::note[标题]\n内容\n:::')).toBe('标题 内容');
    expect(cleanMarkdownToText(':::details[问题]{open}\n答案\n:::')).toBe('问题 答案');
  });

  it('drops highlight markers but keeps equals signs in expressions', () => {
    expect(cleanMarkdownToText('这是 ==重点== 文本，a==b 与 a == b')).toBe('这是 重点 文本，a==b 与 a == b');
  });

  it('removes fenced code before matching spoiler blocks', () => {
    // 若先遮模糊，代码块里未闭合的 :::spoiler 会一直遮到结尾，后文丢失。
    expect(cleanMarkdownToText('```md\n:::spoiler\n```\n\n后文')).toBe('后文');
  });
});
