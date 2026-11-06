import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getEditableThemeSettingsPayload,
  getEditableThemeSettingsState,
  getSiteFaviconLinks,
  getThemeSettings,
  getThemeSettingsReadDiagnostics,
  getThemeSettingsRevision,
  resetThemeSettingsCache,
  toEditableThemeSettingsPayload
} from '../src/lib/theme-settings';

describe('theme-settings revision semantics', () => {
  const originalInternalTestFlag = process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS;
  const originalInternalTestDir = process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS_DIR;
  const tempDirs: string[] = [];

  const createTempSettingsFixture = async (): Promise<string> => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-theme-settings-test-'));
    const settingsDir = path.join(tempRoot, 'settings');
    await cp(path.resolve('src/data/settings'), settingsDir, { recursive: true });
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
      process.env.ASTRO_WHONO_INTERNAL_TEST_SETTINGS_DIR = originalInternalTestDir;
    }

    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
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
    const siteJson = JSON.parse(await readFile(sitePath, 'utf8')) as Record<string, unknown>;
    delete siteJson.footer;
    await writeFile(sitePath, `${JSON.stringify(siteJson, null, 2)}\n`, 'utf8');

    const resolved = getThemeSettings();
    const diagnostics = getThemeSettingsReadDiagnostics(resolved);
    const state = getEditableThemeSettingsState(resolved);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group: 'site',
          code: 'schema-mismatch'
        })
      ])
    );
    expect(state.ok).toBe(false);
    if (!state.ok) {
      expect(state.diagnostics).toEqual(diagnostics);
    }
  });

  it('keeps the console unlocked when ui.json lacks the typography block', async () => {
    const settingsDir = await createTempSettingsFixture();
    const uiPath = path.join(settingsDir, 'ui.json');
    const uiJson = JSON.parse(await readFile(uiPath, 'utf8')) as Record<string, unknown>;
    delete uiJson.typography;
    await writeFile(uiPath, `${JSON.stringify(uiJson, null, 2)}\n`, 'utf8');

    const resolved = getThemeSettings();
    const state = getEditableThemeSettingsState(resolved);

    expect(resolved.settings.ui.typography).toEqual({
      readable: 'noto-serif-sc',
      copy: 'lxgw-wenkai-lite',
      mono: 'system-mono',
      brand: 'serif-georgia'
    });
    expect(getThemeSettingsReadDiagnostics(resolved)).toEqual([]);
    expect(state.ok).toBe(true);
  });

  it('locks the console when ui.json carries an invalid typography font id', async () => {
    const settingsDir = await createTempSettingsFixture();
    const uiPath = path.join(settingsDir, 'ui.json');
    const uiJson = JSON.parse(await readFile(uiPath, 'utf8')) as Record<string, any>;
    uiJson.typography.readable = 'bogus-font';
    await writeFile(uiPath, `${JSON.stringify(uiJson, null, 2)}\n`, 'utf8');

    const resolved = getThemeSettings();
    const diagnostics = getThemeSettingsReadDiagnostics(resolved);
    const state = getEditableThemeSettingsState(resolved);

    expect(resolved.settings.ui.typography.readable).toBe('noto-serif-sc');
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group: 'ui',
          code: 'schema-mismatch'
        })
      ])
    );
    expect(state.ok).toBe(false);
  });

  it('changes revision when typography settings change', () => {
    const resolved = getThemeSettings();
    const mutated = structuredClone(resolved);
    mutated.settings.ui.typography.readable = 'lxgw-wenkai-lite';

    expect(getThemeSettingsRevision(mutated)).not.toBe(getThemeSettingsRevision(resolved));
  });

  it('defaults the article TOC on and keeps the console unlocked when ui.json lacks articleToc', async () => {
    const settingsDir = await createTempSettingsFixture();
    const uiPath = path.join(settingsDir, 'ui.json');
    const uiJson = JSON.parse(await readFile(uiPath, 'utf8')) as Record<string, unknown>;
    delete uiJson.articleToc;
    await writeFile(uiPath, `${JSON.stringify(uiJson, null, 2)}
`, 'utf8');

    const resolved = getThemeSettings();
    const state = getEditableThemeSettingsState(resolved);

    expect(resolved.settings.ui.articleToc).toEqual({ showEntry: true });
    expect(resolved.sources.ui.articleTocShowEntry).toBe('default');
    expect(getThemeSettingsReadDiagnostics(resolved)).toEqual([]);
    expect(state.ok).toBe(true);
  });

  it('defaults article tags to the bottom and keeps the console unlocked when ui.json lacks the position switches', async () => {
    const settingsDir = await createTempSettingsFixture();
    const uiPath = path.join(settingsDir, 'ui.json');
    const uiJson = JSON.parse(await readFile(uiPath, 'utf8')) as Record<string, any>;
    uiJson.articleMeta.showTags = true;
    delete uiJson.articleMeta.showHeaderTags;
    delete uiJson.articleFooter;
    await writeFile(uiPath, `${JSON.stringify(uiJson, null, 2)}
`, 'utf8');

    const resolved = getThemeSettings();

    expect(resolved.settings.ui.articleMeta.showHeaderTags).toBe(false);
    expect(resolved.sources.ui.articleMetaShowHeaderTags).toBe('default');
    expect(resolved.settings.ui.articleFooter).toEqual({
      showTags: true,
      showPrevNext: true,
      sharePlatforms: ['x', 'facebook', 'email', 'poster', 'copy']
    });
    expect(resolved.sources.ui.articleFooterShowPrevNext).toBe('default');
    expect(resolved.sources.ui.articleFooterSharePlatforms).toBe('default');
    expect(getThemeSettingsReadDiagnostics(resolved)).toEqual([]);
    expect(getEditableThemeSettingsState(resolved).ok).toBe(true);
  });

  it('keeps bottom tags off when an older ui.json turned articleMeta.showTags off', async () => {
    const settingsDir = await createTempSettingsFixture();
    const uiPath = path.join(settingsDir, 'ui.json');
    const uiJson = JSON.parse(await readFile(uiPath, 'utf8')) as Record<string, any>;
    uiJson.articleMeta.showTags = false;
    delete uiJson.articleFooter;
    await writeFile(uiPath, `${JSON.stringify(uiJson, null, 2)}
`, 'utf8');

    const resolved = getThemeSettings();

    expect(resolved.settings.ui.articleFooter).toEqual({
      showTags: false,
      showPrevNext: true,
      sharePlatforms: ['x', 'facebook', 'email', 'poster', 'copy']
    });
    expect(resolved.sources.ui.articleFooterShowTags).toBe('legacy');
    expect(getEditableThemeSettingsState(resolved).ok).toBe(true);
  });

  it('reads the header tag, bottom tag and prev/next switches from ui.json independently', async () => {
    const settingsDir = await createTempSettingsFixture();
    const uiPath = path.join(settingsDir, 'ui.json');
    const uiJson = JSON.parse(await readFile(uiPath, 'utf8')) as Record<string, any>;
    uiJson.articleMeta = { ...uiJson.articleMeta, showTags: true, showHeaderTags: true };
    uiJson.articleFooter = { showTags: false, showPrevNext: false, sharePlatforms: ['copy'] };
    await writeFile(uiPath, `${JSON.stringify(uiJson, null, 2)}
`, 'utf8');

    const resolved = getThemeSettings();

    expect(resolved.settings.ui.articleMeta.showTags).toBe(true);
    expect(resolved.settings.ui.articleMeta.showHeaderTags).toBe(true);
    expect(resolved.settings.ui.articleFooter).toEqual({ showTags: false, showPrevNext: false, sharePlatforms: ['copy'] });
    expect(resolved.sources.ui.articleMetaShowHeaderTags).toBe('new');
    expect(resolved.sources.ui.articleFooterShowTags).toBe('new');
    expect(resolved.sources.ui.articleFooterShowPrevNext).toBe('new');
    expect(getEditableThemeSettingsState(resolved).ok).toBe(true);
  });

  it('keeps an empty share list as all platforms off', async () => {
    const settingsDir = await createTempSettingsFixture();
    const uiPath = path.join(settingsDir, 'ui.json');
    const uiJson = JSON.parse(await readFile(uiPath, 'utf8')) as Record<string, any>;
    uiJson.articleFooter = { ...uiJson.articleFooter, sharePlatforms: [] };
    await writeFile(uiPath, `${JSON.stringify(uiJson, null, 2)}
`, 'utf8');

    const resolved = getThemeSettings();

    expect(resolved.settings.ui.articleFooter.sharePlatforms).toEqual([]);
    expect(resolved.sources.ui.articleFooterSharePlatforms).toBe('new');
    expect(getEditableThemeSettingsState(resolved).ok).toBe(true);
  });

  it('renders a hand-edited share list in the fixed order and flags the file for the console', async () => {
    const settingsDir = await createTempSettingsFixture();
    const uiPath = path.join(settingsDir, 'ui.json');
    const uiJson = JSON.parse(await readFile(uiPath, 'utf8')) as Record<string, any>;
    uiJson.articleFooter = { ...uiJson.articleFooter, sharePlatforms: ['copy', 'wechat', 'x', 'x'] };
    await writeFile(uiPath, `${JSON.stringify(uiJson, null, 2)}
`, 'utf8');

    const resolved = getThemeSettings();

    expect(resolved.settings.ui.articleFooter.sharePlatforms).toEqual(['x', 'copy']);
    expect(getThemeSettingsReadDiagnostics(resolved).map((diagnostic) => diagnostic.code)).toEqual(['schema-mismatch']);
  });

  it('falls back to the default share list when the field is not an array', async () => {
    const settingsDir = await createTempSettingsFixture();
    const uiPath = path.join(settingsDir, 'ui.json');
    const uiJson = JSON.parse(await readFile(uiPath, 'utf8')) as Record<string, any>;
    uiJson.articleFooter = { ...uiJson.articleFooter, sharePlatforms: 'x' };
    await writeFile(uiPath, `${JSON.stringify(uiJson, null, 2)}
`, 'utf8');

    const resolved = getThemeSettings();

    expect(resolved.settings.ui.articleFooter.sharePlatforms).toEqual(['x', 'facebook', 'email', 'poster', 'copy']);
    expect(resolved.sources.ui.articleFooterSharePlatforms).toBe('default');
  });

  it('does not share the default share list between resolved copies', async () => {
    const settingsDir = await createTempSettingsFixture();
    const uiPath = path.join(settingsDir, 'ui.json');
    const uiJson = JSON.parse(await readFile(uiPath, 'utf8')) as Record<string, any>;
    uiJson.articleFooter = { ...uiJson.articleFooter };
    delete uiJson.articleFooter.sharePlatforms;
    await writeFile(uiPath, `${JSON.stringify(uiJson, null, 2)}
`, 'utf8');

    const first = getThemeSettings();
    first.settings.ui.articleFooter.sharePlatforms.length = 0;

    expect(getThemeSettings().settings.ui.articleFooter.sharePlatforms).toEqual(['x', 'facebook', 'email', 'poster', 'copy']);
  });

  it('reads an explicit articleToc.showEntry = false from ui.json', async () => {
    const settingsDir = await createTempSettingsFixture();
    const uiPath = path.join(settingsDir, 'ui.json');
    const uiJson = JSON.parse(await readFile(uiPath, 'utf8')) as Record<string, any>;
    uiJson.articleToc.showEntry = false;
    await writeFile(uiPath, `${JSON.stringify(uiJson, null, 2)}
`, 'utf8');

    const resolved = getThemeSettings();
    const state = getEditableThemeSettingsState(resolved);

    expect(resolved.settings.ui.articleToc.showEntry).toBe(false);
    expect(resolved.sources.ui.articleTocShowEntry).toBe('new');
    expect(getThemeSettingsReadDiagnostics(resolved)).toEqual([]);
    expect(state.ok).toBe(true);
  });

  it('locks the console when articleToc.showEntry is not a boolean', async () => {
    const settingsDir = await createTempSettingsFixture();
    const uiPath = path.join(settingsDir, 'ui.json');
    const uiJson = JSON.parse(await readFile(uiPath, 'utf8')) as Record<string, any>;
    uiJson.articleToc.showEntry = 'false';
    await writeFile(uiPath, `${JSON.stringify(uiJson, null, 2)}
`, 'utf8');

    const resolved = getThemeSettings();
    const state = getEditableThemeSettingsState(resolved);

    expect(resolved.settings.ui.articleToc.showEntry).toBe(true);
    expect(getThemeSettingsReadDiagnostics(resolved)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group: 'ui',
          code: 'schema-mismatch'
        })
      ])
    );
    expect(state.ok).toBe(false);
  });

  it('changes revision when the article TOC switch changes', () => {
    const resolved = getThemeSettings();
    const mutated = structuredClone(resolved);
    mutated.settings.ui.articleToc.showEntry = !resolved.settings.ui.articleToc.showEntry;

    expect(getThemeSettingsRevision(mutated)).not.toBe(getThemeSettingsRevision(resolved));
  });

  it('resolves favicon slots to null defaults and emits the default three-link set', () => {
    const resolved = getThemeSettings();

    expect(resolved.settings.site.favicon).toEqual({ svg: null, png: null, appleTouchIcon: null });
    // demo site.json 显式写了三个 null 槽位，来源应标记为 new（显式配置的默认态）。
    expect(resolved.sources.site.faviconPng).toBe('new');
    expect(getSiteFaviconLinks(resolved.settings.site.favicon)).toEqual([
      { rel: 'icon', type: 'image/svg+xml', sizes: 'any', href: 'favicon.svg' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: 'favicon-32x32.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: 'apple-touch-icon.png' }
    ]);
  });

  it('keeps the console unlocked when site.json lacks the favicon block', async () => {
    const settingsDir = await createTempSettingsFixture();
    const sitePath = path.join(settingsDir, 'site.json');
    const siteJson = JSON.parse(await readFile(sitePath, 'utf8')) as Record<string, unknown>;
    delete siteJson.favicon;
    await writeFile(sitePath, `${JSON.stringify(siteJson, null, 2)}\n`, 'utf8');

    const resolved = getThemeSettings();

    expect(resolved.settings.site.favicon).toEqual({ svg: null, png: null, appleTouchIcon: null });
    expect(resolved.sources.site.faviconPng).toBe('default');
    expect(getThemeSettingsReadDiagnostics(resolved)).toEqual([]);
    expect(getEditableThemeSettingsState(resolved).ok).toBe(true);
  });

  it('accepts an existing favicon slot path and suppresses default links for unset slots', async () => {
    const settingsDir = await createTempSettingsFixture();
    const sitePath = path.join(settingsDir, 'site.json');
    const siteJson = JSON.parse(await readFile(sitePath, 'utf8')) as Record<string, any>;
    siteJson.favicon = { svg: null, png: '/favicon-32x32.png', appleTouchIcon: null };
    await writeFile(sitePath, `${JSON.stringify(siteJson, null, 2)}\n`, 'utf8');

    const resolved = getThemeSettings();

    expect(resolved.settings.site.favicon.png).toBe('/favicon-32x32.png');
    expect(resolved.sources.site.faviconPng).toBe('new');
    expect(getThemeSettingsReadDiagnostics(resolved)).toEqual([]);
    // 分组抑制：png 自定义后标签页图标组不再回退默认 SVG；触摸图标独立回退，保持主题默认。
    expect(getSiteFaviconLinks(resolved.settings.site.favicon)).toEqual([
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: 'apple-touch-icon.png' }
    ]);
  });

  it('keeps default tab icons when only the touch icon is customized', async () => {
    const settingsDir = await createTempSettingsFixture();
    const sitePath = path.join(settingsDir, 'site.json');
    const siteJson = JSON.parse(await readFile(sitePath, 'utf8')) as Record<string, any>;
    siteJson.favicon = { svg: null, png: null, appleTouchIcon: '/apple-touch-icon.png' };
    await writeFile(sitePath, `${JSON.stringify(siteJson, null, 2)}\n`, 'utf8');

    const resolved = getThemeSettings();

    expect(getSiteFaviconLinks(resolved.settings.site.favicon)).toEqual([
      { rel: 'icon', type: 'image/svg+xml', sizes: 'any', href: 'favicon.svg' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: 'favicon-32x32.png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
    ]);
  });

  it('falls back to theme defaults without locking the console when a favicon file is missing', async () => {
    const settingsDir = await createTempSettingsFixture();
    const sitePath = path.join(settingsDir, 'site.json');
    const siteJson = JSON.parse(await readFile(sitePath, 'utf8')) as Record<string, any>;
    siteJson.favicon = { svg: null, png: '/images/site/favicon-64x64-deadbeef.png', appleTouchIcon: null };
    await writeFile(sitePath, `${JSON.stringify(siteJson, null, 2)}\n`, 'utf8');

    const resolved = getThemeSettings();

    // 格式合法的路径原样保留（不触发 schema-mismatch），文件缺失只在渲染期回退主题默认。
    expect(resolved.settings.site.favicon.png).toBe('/images/site/favicon-64x64-deadbeef.png');
    expect(getThemeSettingsReadDiagnostics(resolved)).toEqual([]);
    expect(getEditableThemeSettingsState(resolved).ok).toBe(true);
    expect(getSiteFaviconLinks(resolved.settings.site.favicon)).toEqual([
      { rel: 'icon', type: 'image/svg+xml', sizes: 'any', href: 'favicon.svg' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: 'favicon-32x32.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: 'apple-touch-icon.png' }
    ]);
  });

  it('omits the sizes attribute when a favicon file name carries no dimensions', async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-favicon-links-'));
    tempDirs.push(tempRoot);
    const assetDir = path.join(tempRoot, 'public', 'images', 'site');
    await mkdir(assetDir, { recursive: true });
    await Promise.all([
      writeFile(path.join(assetDir, 'favicon-a1b2c3d4.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>'),
      writeFile(path.join(assetDir, 'favicon-notdims.png'), 'png'),
      writeFile(path.join(assetDir, 'apple-touch-icon-180x180-a1b2c3d4.png'), 'png')
    ]);

    process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT = tempRoot;
    try {
      const links = getSiteFaviconLinks({
        svg: '/images/site/favicon-a1b2c3d4.svg',
        png: '/images/site/favicon-notdims.png',
        appleTouchIcon: '/images/site/apple-touch-icon-180x180-a1b2c3d4.png'
      });

      expect(links).toEqual([
        { rel: 'icon', type: 'image/svg+xml', sizes: 'any', href: '/images/site/favicon-a1b2c3d4.svg' },
        { rel: 'icon', type: 'image/png', href: '/images/site/favicon-notdims.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/images/site/apple-touch-icon-180x180-a1b2c3d4.png' }
      ]);
    } finally {
      delete process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT;
    }
  });
});
