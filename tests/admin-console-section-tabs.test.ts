import { describe, expect, it } from 'vitest';
import { getAdminSectionTabIndexForKey } from '../src/scripts/admin-console/section-tabs';

const press = (key: string, modifiers: Partial<Record<'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey', boolean>> = {}) => ({
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...modifiers
});

describe('admin-console/section-tabs', () => {
  it('moves to the next / previous tab and wraps around at both ends', () => {
    expect(getAdminSectionTabIndexForKey(press('ArrowRight'), 0, 6)).toBe(1);
    expect(getAdminSectionTabIndexForKey(press('ArrowRight'), 5, 6)).toBe(0);
    expect(getAdminSectionTabIndexForKey(press('ArrowLeft'), 3, 6)).toBe(2);
    expect(getAdminSectionTabIndexForKey(press('ArrowLeft'), 0, 6)).toBe(5);
  });

  it('jumps to the first / last tab with Home / End', () => {
    expect(getAdminSectionTabIndexForKey(press('Home'), 4, 6)).toBe(0);
    expect(getAdminSectionTabIndexForKey(press('End'), 1, 6)).toBe(5);
  });

  it('ignores other keys and empty tab lists', () => {
    expect(getAdminSectionTabIndexForKey(press('Enter'), 2, 6)).toBeNull();
    expect(getAdminSectionTabIndexForKey(press('ArrowDown'), 2, 6)).toBeNull();
    expect(getAdminSectionTabIndexForKey(press('ArrowRight'), 0, 0)).toBeNull();
  });

  it('leaves modifier combinations to the browser, such as Alt+Left for Back', () => {
    expect(getAdminSectionTabIndexForKey(press('ArrowLeft', { altKey: true }), 2, 6)).toBeNull();
    expect(getAdminSectionTabIndexForKey(press('ArrowRight', { ctrlKey: true }), 2, 6)).toBeNull();
    expect(getAdminSectionTabIndexForKey(press('Home', { metaKey: true }), 2, 6)).toBeNull();
    expect(getAdminSectionTabIndexForKey(press('End', { shiftKey: true }), 2, 6)).toBeNull();
  });
});
