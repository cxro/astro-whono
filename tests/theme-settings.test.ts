import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getEditableThemeSettingsPayload,
  getEditableThemeSettingsState,
  getThemeSettings,
  getThemeSettingsReadDiagnostics,
  getThemeSettingsRevision,
  resetThemeSettingsCache,
  toEditableThemeSettingsPayload,
} from '../src/lib/theme-settings';

describe('theme-settings revision semantics', () => {
  const originalInternalTestFlag =
    process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS;
  const originalInternalTestDir =
    process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS_DIR;
  const tempDirs: string[] = [];

  const createTempSettingsFixture = async (): Promise<string> => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), 'astro-whono-theme-settings-test-')
    );
    const settingsDir = path.join(tempRoot, 'settings');
    await cp(path.resolve('src/data/settings'), settingsDir, {
      recursive: true,
    });
    tempDirs.push(tempRoot);
    process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS = '1';
    process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS_DIR = settingsDir;
    return settingsDir;
  };

  beforeEach(() => {
    resetThemeSettingsCache();
  });

  afterEach(async () => {
    resetThemeSettingsCache();
    if (originalInternalTestFlag === undefined) {
      delete process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS;
    } else {
      process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS = originalInternalTestFlag;
    }

    if (originalInternalTestDir === undefined) {
      delete process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS_DIR;
    } else {
      process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS_DIR =
        originalInternalTestDir;
    }

    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
    );
  });

  it('builds an editable payload whose revision matches the revision helper', () => {
    const resolved = getThemeSettings();
    const payload = getEditableThemeSettingsPayload(resolved);

    expect(payload.revision).toBe(getThemeSettingsRevision(resolved));
    expect('resolvedSocialItems' in payload.settings.site.socialLinks).toBe(
      false
    );
  });

  it('keeps revision stable when only sources change', () => {
    const resolved = getThemeSettings();
    const mutated = structuredClone(resolved);
    mutated.sources.site.title =
      mutated.sources.site.title === 'new' ? 'legacy' : 'new';

    expect(getThemeSettingsRevision(mutated)).toBe(
      getThemeSettingsRevision(resolved)
    );
    expect(toEditableThemeSettingsPayload(mutated).revision).toBe(
      getThemeSettingsRevision(resolved)
    );
  });

  it('changes revision when editable settings change', () => {
    const resolved = getThemeSettings();
    const mutated = structuredClone(resolved);
    mutated.settings.site.title = `${mutated.settings.site.title} fixture`;

    expect(getThemeSettingsRevision(mutated)).not.toBe(
      getThemeSettingsRevision(resolved)
    );
    expect(toEditableThemeSettingsPayload(mutated).settings.site.title).toBe(
      mutated.settings.site.title
    );
  });

  it('allows missing settings files to keep falling back without locking the console', async () => {
    const settingsDir = await createTempSettingsFixture();
    await rm(path.join(settingsDir, 'page.json'), { force: true });

    const resolved = getThemeSettings();
    const state = getEditableThemeSettingsState(resolved);

    expect(state.ok).toBe(true);
    expect(getThemeSettingsReadDiagnostics(resolved)).toEqual([]);
  });

  it('locks the console when an existing settings file would be silently repaired', async () => {
    const settingsDir = await createTempSettingsFixture();
    const sitePath = path.join(settingsDir, 'site.json');
    const siteJson = JSON.parse(await readFile(sitePath, 'utf8')) as Record<
      string,
      unknown
    >;
    delete siteJson.footer;
    await writeFile(sitePath, `${JSON.stringify(siteJson, null, 2)}\n`, 'utf8');

    const resolved = getThemeSettings();
    const diagnostics = getThemeSettingsReadDiagnostics(resolved);
    const state = getEditableThemeSettingsState(resolved);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group: 'site',
          code: 'schema-mismatch',
        }),
      ])
    );
    expect(state.ok).toBe(false);
    if (!state.ok) {
      expect(state.diagnostics).toEqual(diagnostics);
    }
  });
});
