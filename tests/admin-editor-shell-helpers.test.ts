import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clampEditorSidePanelStackedRatio,
  getEditorSidePanelLayout,
  getEditorSidePanelStackedRatioFromPointer,
  normalizeEditorTextareaValue,
  readStoredEditorSidePanelPreference
} from '../src/components/admin/editor/editor-shell-helpers';

describe('admin editor shell helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes editor textarea line endings to browser value coordinates', () => {
    expect(normalizeEditorTextareaValue('A\r\nB\rC\nD')).toBe('A\nB\nC\nD');
  });

  it('derives side panel layout from outline and syntax intent', () => {
    expect(
      getEditorSidePanelLayout({
        outlineOpen: false,
        syntaxOpen: false,
        syntaxMaximized: false,
        available: true
      })
    ).toBe('none');
    expect(
      getEditorSidePanelLayout({
        outlineOpen: true,
        syntaxOpen: false,
        syntaxMaximized: false,
        available: true
      })
    ).toBe('outline');
    expect(
      getEditorSidePanelLayout({
        outlineOpen: false,
        syntaxOpen: true,
        syntaxMaximized: false,
        available: true
      })
    ).toBe('syntax');
    expect(
      getEditorSidePanelLayout({
        outlineOpen: true,
        syntaxOpen: true,
        syntaxMaximized: false,
        available: true
      })
    ).toBe('stacked');
    expect(
      getEditorSidePanelLayout({
        outlineOpen: true,
        syntaxOpen: true,
        syntaxMaximized: true,
        available: true
      })
    ).toBe('syntaxMaximized');
  });

  it('hides side panels when the editor width cannot support them', () => {
    expect(
      getEditorSidePanelLayout({
        outlineOpen: true,
        syntaxOpen: true,
        syntaxMaximized: true,
        available: false
      })
    ).toBe('none');
  });

  it('ignores maximized state when syntax is closed', () => {
    expect(
      getEditorSidePanelLayout({
        outlineOpen: true,
        syntaxOpen: false,
        syntaxMaximized: true,
        available: true
      })
    ).toBe('outline');
  });

  it('treats maximized syntax as a stacked-layout override only', () => {
    expect(
      getEditorSidePanelLayout({
        outlineOpen: false,
        syntaxOpen: true,
        syntaxMaximized: true,
        available: true
      })
    ).toBe('syntax');
  });

  it('reads legacy outline state as side panel preference with syntax closed', () => {
    const localStorage = {
      getItem: vi.fn(() => JSON.stringify({
        open: true,
        activeTab: 'headings'
      })),
      setItem: vi.fn()
    };
    vi.stubGlobal('window', { localStorage });

    expect(readStoredEditorSidePanelPreference('side-panel')).toEqual({
      outlineOpen: true,
      outlineActiveTab: 'headings',
      syntaxOpen: false
    });
  });

  it('clamps stacked side panel ratios to usable bounds', () => {
    expect(clampEditorSidePanelStackedRatio(10, 1000)).toBe(20);
    expect(clampEditorSidePanelStackedRatio(90, 1000)).toBe(80);
    expect(clampEditorSidePanelStackedRatio(25, 300)).toBe(40);
    expect(clampEditorSidePanelStackedRatio(80, 300)).toBe(50);
  });

  it('derives stacked side panel ratio from pointer position', () => {
    expect(getEditorSidePanelStackedRatioFromPointer(100, 500, 350)).toBe(50);
    expect(getEditorSidePanelStackedRatioFromPointer(100, 500, 80)).toBe(24);
  });
});
