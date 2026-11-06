import { describe, expect, it } from 'vitest';
import {
  applyMarkdownToolbarCommandToText,
  applyMarkdownToolToText,
  insertMarkdownText,
  replaceMarkdownText,
  type MarkdownTextEdit
} from '../src/components/admin/editor/markdown/editor-markdown-transforms';
import { createMarkdownCommandDispatcher } from '../src/components/admin/editor/markdown/editor-markdown-command-dispatcher';
import {
  MARKDOWN_DETAILS_INSERT_TOOL,
  MARKDOWN_DETAILS_SUMMARY_PLACEHOLDER,
  MARKDOWN_MATH_INSERT_TOOLS
} from '../src/components/admin/editor/markdown/insert-tools';
import type { MarkdownToolbarCommand } from '../src/components/admin/editor/markdown/markdown-tools';

const expectMarkdownEdit = (
  source: string,
  edit: MarkdownTextEdit,
  expected: {
    value: string;
    selection: MarkdownTextEdit['selection'];
  }
) => {
  expect(`${source.slice(0, edit.from)}${edit.insert}${source.slice(edit.to)}`).toBe(expected.value);
  expect(edit.selection).toEqual(expected.selection);
};

const getDetailsSummarySelection = (value: string): MarkdownTextEdit['selection'] => {
  const from = value.indexOf(MARKDOWN_DETAILS_SUMMARY_PLACEHOLDER);
  return { from, to: from + MARKDOWN_DETAILS_SUMMARY_PLACEHOLDER.length };
};

describe('admin editor markdown transforms', () => {
  it('wraps empty and non-empty inline selections', () => {
    expectMarkdownEdit('Hello ', applyMarkdownToolToText('Hello ', { from: 6, to: 6 }, 'bold'), {
      value: 'Hello **text**',
      selection: { from: 8, to: 12 }
    });

    expectMarkdownEdit('Hello world', applyMarkdownToolToText('Hello world', { from: 6, to: 11 }, 'italic'), {
      value: 'Hello *world*',
      selection: { from: 7, to: 12 }
    });
  });

  it('wraps empty and non-empty inline math selections', () => {
    expect(MARKDOWN_MATH_INSERT_TOOLS.find((tool) => tool.id === 'inlineMath')).toMatchObject({
      type: 'math',
      label: '行内公式',
      icon: 'sigma'
    });

    expectMarkdownEdit('Equation: ', applyMarkdownToolToText('Equation: ', { from: 10, to: 10 }, 'inlineMath'), {
      value: 'Equation: $$x$$',
      selection: { from: 12, to: 13 }
    });

    expectMarkdownEdit('E = mc^2', applyMarkdownToolToText('E = mc^2', { from: 0, to: 8 }, 'inlineMath'), {
      value: '$$E = mc^2$$',
      selection: { from: 2, to: 10 }
    });
  });

  it('inserts block math as an independent editable block', () => {
    expect(MARKDOWN_MATH_INSERT_TOOLS.find((tool) => tool.id === 'blockMath')).toMatchObject({
      type: 'math',
      label: '块级公式',
      icon: 'square-sigma'
    });

    expectMarkdownEdit('Intro\nOutro', applyMarkdownToolToText('Intro\nOutro', { from: 6, to: 6 }, 'blockMath'), {
      value: 'Intro\n$$\nx\n$$\nOutro',
      selection: { from: 9, to: 10 }
    });

    expectMarkdownEdit('Alpha\nBeta\nGamma', applyMarkdownToolToText('Alpha\nBeta\nGamma', { from: 0, to: 10 }, 'blockMath'), {
      value: '$$\nAlpha\nBeta\n$$\nGamma',
      selection: { from: 3, to: 13 }
    });
  });

  it('applies and removes line prefixes across selected lines', () => {
    expectMarkdownEdit('One\nTwo', applyMarkdownToolToText('One\nTwo', { from: 0, to: 7 }, 'list'), {
      value: '- One\n- Two',
      selection: { from: 0, to: 11 }
    });

    expectMarkdownEdit('- One\n- Two', applyMarkdownToolToText('- One\n- Two', { from: 0, to: 11 }, 'list'), {
      value: 'One\nTwo',
      selection: { from: 0, to: 7 }
    });
  });

  it('sets heading levels while preserving shallow indentation', () => {
    const edit = applyMarkdownToolbarCommandToText('  ## Old', { from: 2, to: 8 }, {
      id: 1,
      kind: 'heading',
      level: 3
    });

    expectMarkdownEdit('  ## Old', edit, {
      value: '  ### Old',
      selection: { from: 0, to: 9 }
    });
  });

  it('inserts callouts and image markdown at the current selection', () => {
    const calloutEdit = applyMarkdownToolbarCommandToText('Intro', { from: 5, to: 5 }, {
      id: 1,
      kind: 'callout',
      calloutType: 'note'
    });

    expectMarkdownEdit('Intro', calloutEdit, {
      value: 'Intro\n:::note[标题]\n内容\n:::\n',
      selection: { from: 25, to: 25 }
    });

    expectMarkdownEdit('Intro outro', insertMarkdownText('Intro outro', { from: 6, to: 11 }, '![Alt](./image.webp)'), {
      value: 'Intro ![Alt](./image.webp)',
      selection: { from: 26, to: 26 }
    });
  });

  it('applies details blocks as a toolbar tool', () => {
    expect(MARKDOWN_DETAILS_INSERT_TOOL).toMatchObject({
      type: 'details',
      id: 'details',
      label: '折叠内容',
      icon: 'list-collapse',
      placement: 'block'
    });

    const edit = applyMarkdownToolToText('Intro', { from: 5, to: 5 }, MARKDOWN_DETAILS_INSERT_TOOL.id);
    const expectedValue = `Intro\n\n${MARKDOWN_DETAILS_INSERT_TOOL.text}\n`;

    expectMarkdownEdit('Intro', edit, {
      value: expectedValue,
      selection: getDetailsSummarySelection(expectedValue)
    });

    const source = 'Intro\n\nAlpha\nBeta\n\nOutro';
    const wrappedEdit = applyMarkdownToolToText(source, { from: 7, to: 17 }, MARKDOWN_DETAILS_INSERT_TOOL.id);
    const wrappedValue = 'Intro\n\n:::details[标题]\nAlpha\nBeta\n:::\n\nOutro';

    expectMarkdownEdit(source, wrappedEdit, {
      value: wrappedValue,
      selection: getDetailsSummarySelection(wrappedValue)
    });
  });

  it('lengthens the details fence when the body already has directive fences', () => {
    const source = ':::note\nA\n:::';
    const edit = applyMarkdownToolToText(source, { from: 0, to: source.length }, MARKDOWN_DETAILS_INSERT_TOOL.id);
    const expectedValue = '::::details[标题]\n:::note\nA\n:::\n::::\n';

    expectMarkdownEdit(source, edit, {
      value: expectedValue,
      selection: getDetailsSummarySelection(expectedValue)
    });
  });

  it('wraps highlight and spoiler selections', () => {
    expectMarkdownEdit('Hi ', applyMarkdownToolToText('Hi ', { from: 3, to: 3 }, 'highlight'), {
      value: 'Hi ==text==',
      selection: { from: 5, to: 9 }
    });
    expectMarkdownEdit('结局是他', applyMarkdownToolToText('结局是他', { from: 3, to: 4 }, 'spoiler'), {
      value: '结局是:spoiler[他]',
      selection: { from: 12, to: 13 }
    });
    expectMarkdownEdit('A\nB\nC', applyMarkdownToolToText('A\nB\nC', { from: 0, to: 3 }, 'spoiler'), {
      value: ':::spoiler\nA\nB\n:::\nC',
      selection: { from: 11, to: 14 }
    });
  });

  it('replaces selected image ranges with inline or block output', () => {
    expectMarkdownEdit(
      'Intro ![Old](./old.webp) outro',
      replaceMarkdownText(
        'Intro ![Old](./old.webp) outro',
        { from: 6, to: 24 },
        '![New](./new.webp)'
      ),
      {
        value: 'Intro ![New](./new.webp) outro',
        selection: { from: 24, to: 24 }
      }
    );

    const figure = [
      '<figure class="figure figure--md figure--left">',
      '  <img src="./new.webp" alt="New" />',
      '</figure>'
    ].join('\n');
    expectMarkdownEdit(
      'Intro ![Old](./old.webp) outro',
      replaceMarkdownText(
        'Intro ![Old](./old.webp) outro',
        { from: 6, to: 24 },
        figure,
        'block'
      ),
      {
        value: `Intro \n\n${figure}\n\n outro`,
        selection: { from: 104, to: 104 }
      }
    );
  });

  it('creates ordered lists using selected line order', () => {
    expectMarkdownEdit('One\nTwo\nThree', applyMarkdownToolToText('One\nTwo\nThree', { from: 0, to: 13 }, 'orderedList'), {
      value: '1. One\n2. Two\n3. Three',
      selection: { from: 0, to: 22 }
    });
  });

  it('keeps existing code block and table transforms stable', () => {
    expectMarkdownEdit('Intro', applyMarkdownToolToText('Intro', { from: 5, to: 5 }, 'codeBlock'), {
      value: 'Intro\n```text\ncode\n```',
      selection: { from: 14, to: 18 }
    });

    const tableText = '\n| Column | Column |\n| --- | --- |\n| Cell | Cell |\n';
    expectMarkdownEdit('Intro', applyMarkdownToolToText('Intro', { from: 5, to: 5 }, 'table'), {
      value: `Intro${tableText}`,
      selection: { from: 5 + tableText.length, to: 5 + tableText.length }
    });
  });

  it('keeps dispatcher busy guard for new insert tool commands', () => {
    const commands: MarkdownToolbarCommand[] = [];
    let busy = true;
    const dispatcher = createMarkdownCommandDispatcher({
      isBusy: () => busy,
      onCommand: (command) => commands.push(command)
    });

    dispatcher.applyTool('inlineMath');
    expect(commands).toEqual([]);

    busy = false;
    dispatcher.applyTool('blockMath');
    dispatcher.applyTool('details');
    expect(commands).toEqual([
      { id: 1, kind: 'tool', toolId: 'blockMath' },
      { id: 2, kind: 'tool', toolId: 'details' }
    ]);
  });

  it('routes image tools through the editor command pipeline', () => {
    const commands: MarkdownToolbarCommand[] = [];
    const dispatcher = createMarkdownCommandDispatcher({
      isBusy: () => false,
      onCommand: (command) => commands.push(command)
    });

    dispatcher.applyTool('image');
    dispatcher.replaceText({ from: 2, to: 5 }, '![Alt](./image.webp)');

    expect(commands).toEqual([
      { id: 1, kind: 'tool', toolId: 'image' },
      { id: 2, kind: 'replace', from: 2, to: 5, text: '![Alt](./image.webp)' }
    ]);
  });
});
