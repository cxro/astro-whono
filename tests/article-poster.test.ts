import { describe, expect, it } from 'vitest';
import { getPosterQrCellSize, wrapPosterText } from '../src/lib/article-poster';

// 每个字符宽 1，断言可以直接按字数写。
const measure = (text: string) => Array.from(text).length;

describe('article-poster', () => {
  describe('wrapPosterText', () => {
    it('breaks Latin text between words', () => {
      expect(wrapPosterText('hello world foo', measure, 11, 3)).toEqual(['hello world', 'foo']);
    });

    it('keeps every Chinese character and stays inside the width', () => {
      const text = '这是一段用来验证换行的中文摘要内容';
      const lines = wrapPosterText(text, measure, 6, 10);

      expect(lines.join('')).toBe(text);
      lines.forEach((line) => expect(measure(line)).toBeLessThanOrEqual(6));
    });

    it('keeps closing punctuation off the start of a line', () => {
      expect(wrapPosterText('你好，世界', measure, 2, 3)).toEqual(['你好，', '世界']);
    });

    it('splits a token wider than the line', () => {
      expect(wrapPosterText('x'.repeat(20), measure, 8, 3)).toEqual(['x'.repeat(8), 'x'.repeat(8), 'x'.repeat(4)]);
    });

    it('ends the last line with an ellipsis when text is cut', () => {
      const lines = wrapPosterText('aaaa bbbb cccc dddd eeee', measure, 9, 2);

      expect(lines).toEqual(['aaaa bbbb', 'cccc ddd…']);
      expect(measure(lines[1] ?? '')).toBeLessThanOrEqual(9);
    });

    it('leaves text that fits exactly untouched', () => {
      expect(wrapPosterText('aaaa bbbb', measure, 9, 1)).toEqual(['aaaa bbbb']);
    });

    it('collapses whitespace and returns nothing for empty text', () => {
      expect(wrapPosterText('  a \n  b  ', measure, 10, 2)).toEqual(['a b']);
      expect(wrapPosterText('   ', measure, 10, 2)).toEqual([]);
    });
  });

  describe('getPosterQrCellSize', () => {
    it('fills the target size with whole pixels per module', () => {
      expect(getPosterQrCellSize(37, 192)).toBe(5);
    });

    it('never drops below the readable minimum for dense codes', () => {
      expect(getPosterQrCellSize(73, 192)).toBe(3);
    });
  });
});
