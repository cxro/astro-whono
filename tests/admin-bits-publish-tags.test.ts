import { describe, expect, it } from 'vitest';
import {
  fromInlineBitsTags,
  mergeBitsPublishTagsText,
  normalizeBitsLocationInput,
  splitBitsPublishTagsText,
  toInlineBitsTags
} from '../src/components/admin/editor/bits-publish-tags';

describe('bits publish tags helpers', () => {
  it('splits location tags from stored tags text for the publish strip', () => {
    expect(splitBitsPublishTagsText([
      'LOC: 上海',
      '摄影',
      '#建筑'
    ].join('\n'))).toEqual({
      locationText: '上海',
      inlineTagsText: '#摄影 #建筑'
    });
  });

  it('normalizes inline hash tags, separators and accidental location tags', () => {
    expect(fromInlineBitsTags(' #摄影， #建筑,  LOC:旧地点   #夜景 ')).toEqual([
      '摄影',
      '建筑',
      '夜景'
    ]);
  });

  it('merges location and inline tags back into the saved tags text', () => {
    expect(mergeBitsPublishTagsText(' loc: 北京 ', ' #摄影， #建筑  LOC:旧地点 #夜景 ')).toBe([
      'loc:北京',
      '摄影',
      '建筑',
      '夜景'
    ].join('\n'));
  });

  it('keeps empty input compact', () => {
    expect(normalizeBitsLocationInput(' LOC:  ')).toBe('');
    expect(toInlineBitsTags(['', '#daily', '  建筑  '])).toBe('#daily #建筑');
    expect(mergeBitsPublishTagsText('', ' LOC:旧地点  #daily ')).toBe('daily');
  });
});
