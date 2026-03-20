import { beforeEach, describe, expect, it } from 'vitest';
import {
  getEditableThemeSettingsPayload,
  getThemeSettings,
  getThemeSettingsRevision,
  resetThemeSettingsCache,
  toEditableThemeSettingsPayload
} from '../src/lib/theme-settings';

describe('theme-settings revision semantics', () => {
  beforeEach(() => {
    resetThemeSettingsCache();
  });

  it('builds an editable payload whose revision matches the revision helper', () => {
    const resolved = getThemeSettings();
    const payload = getEditableThemeSettingsPayload(resolved);

    expect(payload.revision).toBe(getThemeSettingsRevision(resolved));
    expect('resolvedSocialItems' in payload.settings.site.socialLinks).toBe(false);
  });

  it('keeps revision stable when only sources change', () => {
    const resolved = getThemeSettings();
    const mutated = structuredClone(resolved);
    mutated.sources.site.title = mutated.sources.site.title === 'new' ? 'legacy' : 'new';

    expect(getThemeSettingsRevision(mutated)).toBe(getThemeSettingsRevision(resolved));
    expect(toEditableThemeSettingsPayload(mutated).revision).toBe(getThemeSettingsRevision(resolved));
  });

  it('changes revision when editable settings change', () => {
    const resolved = getThemeSettings();
    const mutated = structuredClone(resolved);
    mutated.settings.site.title = `${mutated.settings.site.title} fixture`;

    expect(getThemeSettingsRevision(mutated)).not.toBe(getThemeSettingsRevision(resolved));
    expect(toEditableThemeSettingsPayload(mutated).settings.site.title).toBe(mutated.settings.site.title);
  });
});
