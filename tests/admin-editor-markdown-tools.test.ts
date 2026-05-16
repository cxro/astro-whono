import { describe, expect, it } from 'vitest';
import { getMarkdownShortcutTool } from '../src/components/admin/editor/markdown-tools';

describe('admin editor markdown tools', () => {
  it('maps primary-key shortcuts to markdown toolbar tools', () => {
    expect(getMarkdownShortcutTool({ key: 'b', ctrlKey: true })).toBe('bold');
    expect(getMarkdownShortcutTool({ key: 'I', ctrlKey: true })).toBe('italic');
    expect(getMarkdownShortcutTool({ key: 'k', metaKey: true })).toBe('link');
  });

  it('ignores unmodified, shifted, alt-modified, and unknown shortcuts', () => {
    expect(getMarkdownShortcutTool({ key: 'b' })).toBeNull();
    expect(getMarkdownShortcutTool({ key: 'i', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(getMarkdownShortcutTool({ key: 'c', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(getMarkdownShortcutTool({ key: 'b', ctrlKey: true, altKey: true })).toBeNull();
    expect(getMarkdownShortcutTool({ key: 'x', ctrlKey: true })).toBeNull();
  });
});
