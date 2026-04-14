import { describe, expect, it } from 'vitest';

import {
  ADMIN_SETTINGS_EXPORT_SCHEMA_VERSION,
  createAdminSettingsExportBundle,
  parseAdminSettingsExportBundle
} from '../src/lib/admin-console/settings-data';
import { getEditableThemeSettingsPayload } from '../src/lib/theme-settings';

describe('admin-console/settings-data', () => {
  it('creates a settings export bundle with manifest metadata', () => {
    const payload = getEditableThemeSettingsPayload();
    const bundle = createAdminSettingsExportBundle(payload, {
      createdAt: '2026-04-01T08:00:00.000Z'
    });

    expect(bundle.manifest.schemaVersion).toBe(ADMIN_SETTINGS_EXPORT_SCHEMA_VERSION);
    expect(bundle.manifest.createdAt).toBe('2026-04-01T08:00:00.000Z');
    expect(bundle.manifest.includedScopes).toEqual(['settings']);
    expect(bundle.manifest.locale).toBe(payload.settings.site.defaultLocale);
    expect(bundle.settings).toEqual(payload.settings);
  });

  it('accepts older bundles that do not provide manifest.locale', () => {
    const payload = getEditableThemeSettingsPayload();
    const bundle = createAdminSettingsExportBundle(payload);
    const legacyBundle = {
      ...bundle,
      manifest: {
        ...bundle.manifest
      } as Record<string, unknown>
    };
    delete legacyBundle.manifest.locale;

    const parsed = parseAdminSettingsExportBundle(legacyBundle);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.bundle.manifest.locale).toBeNull();
      expect(parsed.bundle.settings).toEqual(bundle.settings);
    }
  });

  it('rejects bundles that do not declare settings in includedScopes', () => {
    const payload = getEditableThemeSettingsPayload();
    const bundle = createAdminSettingsExportBundle(payload);

    const parsed = parseAdminSettingsExportBundle({
      ...bundle,
      manifest: {
        ...bundle.manifest,
        includedScopes: ['content']
      }
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toContain('manifest.includedScopes 必须包含 settings');
    }
  });

});
