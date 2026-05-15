import { describe, expect, it } from 'vitest';
import {
  buildEssayOutlineListItems,
  extractMarkdownOutline,
  getMarkdownOutlineSelectionRange
} from '../src/lib/admin-console/editor-outline';

describe('admin editor outline helpers', () => {
  it('extracts H2 and H3 headings in source order with stable source keys', () => {
    const source = [
      '# Title',
      '## Section',
      '### Detail',
      '#### Hidden',
      '## Section'
    ].join('\n');

    expect(extractMarkdownOutline(source)).toMatchObject([
      { key: '2:8', level: 2, label: 'Section', line: 2, offset: 8 },
      { key: '3:19', level: 3, label: 'Detail', line: 3, offset: 19 },
      { key: '5:42', level: 2, label: 'Section', line: 5, offset: 42 }
    ]);
  });

  it('ignores headings inside fenced code blocks', () => {
    const source = [
      '## Before',
      '```md',
      '## Code heading',
      '```',
      '### After',
      '~~~',
      '### Tilde code',
      '~~~'
    ].join('\n');

    expect(extractMarkdownOutline(source).map((item) => item.label)).toEqual([
      'Before',
      'After'
    ]);
  });

  it('handles indentation, closing hashes and empty headings', () => {
    const source = [
      '   ## Indented ###',
      '##',
      '### ###',
      '    ## Code-like indent',
      '## Label # not closing'
    ].join('\n');

    expect(extractMarkdownOutline(source).map((item) => item.label)).toEqual([
      'Indented',
      'Label # not closing'
    ]);
  });

  it('returns a bounded selection range for an outline item', () => {
    const source = 'Intro\n## Selected heading\nBody';
    const [item] = extractMarkdownOutline(source);

    expect(item).toBeDefined();
    expect(getMarkdownOutlineSelectionRange(source, item!)).toEqual({
      selectionStart: 9,
      selectionEnd: 25
    });

    const wideSeparatorSource = '##   Wide heading ###';
    const [wideSeparatorItem] = extractMarkdownOutline(wideSeparatorSource);
    expect(wideSeparatorItem).toMatchObject({
      label: 'Wide heading',
      labelStart: 5,
      labelEnd: 17
    });
    expect(getMarkdownOutlineSelectionRange(wideSeparatorSource, wideSeparatorItem!)).toEqual({
      selectionStart: 5,
      selectionEnd: 17
    });
  });

  it('builds essay list items with active state and title fallback', () => {
    expect(
      buildEssayOutlineListItems(
        [
          {
            entryId: 'current',
            title: '',
            editHref: '/admin/content/essay/_edit/current/',
            dateLabel: '2026-05-14',
            sourceError: null
          },
          {
            entryId: 'other',
            title: 'Other Essay',
            editHref: '/admin/content/essay/_edit/other/',
            sourceError: 'essay.date 缺失'
          }
        ],
        'current'
      )
    ).toEqual([
      {
        entryId: 'current',
        title: 'current',
        editHref: '/admin/content/essay/_edit/current/',
        dateLabel: '2026-05-14',
        sourceError: null,
        active: true
      },
      {
        entryId: 'other',
        title: 'Other Essay',
        editHref: '/admin/content/essay/_edit/other/',
        sourceError: 'essay.date 缺失',
        active: false
      }
    ]);
  });
});
