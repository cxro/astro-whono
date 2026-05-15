import { describe, expect, it } from 'vitest';
import { normalizeEditorTextareaValue } from '../src/components/admin/editor/editor-shell-helpers';

describe('admin editor shell helpers', () => {
  it('normalizes editor textarea line endings to browser value coordinates', () => {
    expect(normalizeEditorTextareaValue('A\r\nB\rC\nD')).toBe('A\nB\nC\nD');
  });
});
