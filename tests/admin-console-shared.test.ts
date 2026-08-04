import { describe, expect, it } from 'vitest';
import {
  canonicalizeAdminThemeSettings,
  createAdminThemeSettingsCanonicalMismatchIssues,
  fillAdminThemeSettingsCompatibilityDefaults,
  getAdminNavOrderIssues,
  getAdminSocialOrderIssues,
  validateAdminThemeSettings
} from '../src/lib/admin-console/shared';
import {
  getAdminImageFieldPreviewSrc,
  getAdminRenderedImagePreviewSrc
} from '../src/lib/admin-console/image-params';
import { getEditableThemeSettingsPayload, type EditableThemeSettings } from '../src/lib/theme-settings';
import {
  buildSearchHaystack,
  getBitsAvatarLocalFilePath,
  getHeroImageLocalFilePath,
  getSiteFaviconLocalFilePath,
  getSiteFaviconSizesFromPath,
  normalizeBitsAvatarPath,
  normalizeHeroImageSrc,
  normalizeSiteFaviconPath,
  tokenizeSearchQuery
} from '../src/utils/format';

describe('admin-console/shared', () => {
  it('reports duplicate and range issues for social orders', () => {
    expect(
      getAdminSocialOrderIssues(
        { github: 1, x: 1, email: 99 },
        [{ key: 'custom-1', order: 2 }, { key: 'custom-2', order: 2 }]
      )
    ).toEqual([
      { type: 'duplicate', scope: 'preset', key: 'github', order: 1 },
      { type: 'duplicate', scope: 'preset', key: 'x', order: 1 },
      { type: 'range', scope: 'preset', key: 'email', order: 99 },
      { type: 'duplicate', scope: 'custom', key: 'custom-1', order: 2 },
      { type: 'duplicate', scope: 'custom', key: 'custom-2', order: 2 }
    ]);
  });

  it('reports duplicate and range issues for nav orders', () => {
    expect(
      getAdminNavOrderIssues([
        { key: 'essay', order: 1 },
        { key: 'bits', order: 1 },
        { key: 'memo', order: 0 }
      ])
    ).toEqual([
      { type: 'duplicate', key: 'essay', order: 1 },
      { type: 'duplicate', key: 'bits', order: 1 },
      { type: 'range', key: 'memo', order: 0 }
    ]);
  });

  it('normalizes valid hero image sources and rejects invalid local paths', () => {
    expect(normalizeHeroImageSrc('@/assets/hero/cover.webp')).toBe('src/assets/hero/cover.webp');
    expect(normalizeHeroImageSrc('public/images/hero.png')).toBe('/images/hero.png');
    expect(normalizeHeroImageSrc('https://example.com/hero.avif')).toBe('https://example.com/hero.avif');
    expect(normalizeHeroImageSrc('/images/hero.png?size=2')).toBeUndefined();
    expect(normalizeHeroImageSrc('../hero.png')).toBeUndefined();
    expect(getHeroImageLocalFilePath('src/assets/hero/cover.webp')).toBe('src/assets/hero/cover.webp');
    expect(getHeroImageLocalFilePath('/images/hero.png')).toBe('public/images/hero.png');
  });

  it('normalizes bits avatar paths and rejects invalid values', () => {
    expect(normalizeBitsAvatarPath(' author/avatar.webp ')).toBe('author/avatar.webp');
    expect(normalizeBitsAvatarPath('')).toBe('');
    expect(normalizeBitsAvatarPath('/author/avatar.webp')).toBeUndefined();
    expect(normalizeBitsAvatarPath('public/author/avatar.webp')).toBeUndefined();
    expect(normalizeBitsAvatarPath('https://example.com/avatar.webp')).toBeUndefined();
    expect(normalizeBitsAvatarPath('author/avatar.webp?v=2')).toBeUndefined();
    expect(getBitsAvatarLocalFilePath('author/avatar.webp')).toBe('public/author/avatar.webp');
  });

  it('normalizes site favicon paths per slot and parses sizes from file names', () => {
    expect(normalizeSiteFaviconPath('png', 'public/images/site/favicon-64x64-a1b2c3d4.png')).toBe(
      '/images/site/favicon-64x64-a1b2c3d4.png'
    );
    expect(normalizeSiteFaviconPath('png', ' /favicon-32x32.png ')).toBe('/favicon-32x32.png');
    expect(normalizeSiteFaviconPath('svg', '/favicon.svg')).toBe('/favicon.svg');
    expect(normalizeSiteFaviconPath('png', null)).toBeNull();
    expect(normalizeSiteFaviconPath('png', '')).toBeNull();
    expect(normalizeSiteFaviconPath('png', '/favicon.svg')).toBeUndefined();
    expect(normalizeSiteFaviconPath('svg', '/favicon.png')).toBeUndefined();
    expect(normalizeSiteFaviconPath('png', 'https://example.com/favicon.png')).toBeUndefined();
    expect(normalizeSiteFaviconPath('png', '/images/site/../secret.png')).toBeUndefined();
    expect(normalizeSiteFaviconPath('png', '/favicon.png?v=2')).toBeUndefined();
    expect(getSiteFaviconLocalFilePath('/images/site/favicon-64x64-a1b2c3d4.png')).toBe(
      'public/images/site/favicon-64x64-a1b2c3d4.png'
    );
    expect(getSiteFaviconSizesFromPath('/images/site/favicon-64x64-a1b2c3d4.png')).toBe('64x64');
    expect(getSiteFaviconSizesFromPath('/favicon-32x32.png')).toBe('32x32');
    expect(getSiteFaviconSizesFromPath('/images/site/favicon-a1b2c3d4.svg')).toBeNull();
  });

  it('normalizes admin image field preview sources through field contracts', () => {
    expect(getAdminImageFieldPreviewSrc('bits.images', 'bits/demo.webp', '/blog/')).toBe('/blog/bits/demo.webp');
    expect(getAdminImageFieldPreviewSrc('bits.images', 'https://example.com/demo.webp')).toBe(
      'https://example.com/demo.webp'
    );
    expect(getAdminImageFieldPreviewSrc('bits.images', 'http://example.com/demo.webp')).toBeNull();
    expect(getAdminImageFieldPreviewSrc('bits.images', 'data:image/png;base64,demo.png')).toBeNull();
    expect(getAdminImageFieldPreviewSrc('bits.images', '//example.com/demo.webp')).toBeNull();
    expect(getAdminImageFieldPreviewSrc('bits.images', '../demo.webp')).toBeNull();

    expect(getAdminImageFieldPreviewSrc('home.heroImageSrc', '/images/hero.png', '/blog/')).toBe('/blog/images/hero.png');
    expect(getAdminImageFieldPreviewSrc('home.heroImageSrc', 'src/assets/hero.png')).toBeNull();
    expect(getAdminImageFieldPreviewSrc('home.heroImageSrc', 'https://example.com/hero.webp')).toBe(
      'https://example.com/hero.webp'
    );
    expect(getAdminImageFieldPreviewSrc('home.heroImageSrc', 'http://example.com/hero.webp')).toBeNull();

    expect(getAdminImageFieldPreviewSrc('page.bits.defaultAuthor.avatar', 'author/avatar.svg', '/blog/')).toBe(
      '/blog/author/avatar.svg'
    );
  });

  it('normalizes rendered admin image preview sources before assigning img src', () => {
    expect(getAdminRenderedImagePreviewSrc('/_astro/hero.hash.png', '/blog/')).toBe('/blog/_astro/hero.hash.png');
    expect(getAdminRenderedImagePreviewSrc('/_astro/hero.hash.png?origWidth=1200&origHeight=800', '/blog/')).toBe(
      '/blog/_astro/hero.hash.png?origWidth=1200&origHeight=800'
    );
    expect(getAdminRenderedImagePreviewSrc('/blog/_astro/hero.hash.png', '/blog/')).toBe('/blog/_astro/hero.hash.png');
    expect(getAdminRenderedImagePreviewSrc('/@fs/D:/Server-Related/dev/astro-whono/src/assets/hero.png')).toBe(
      '/@fs/D:/Server-Related/dev/astro-whono/src/assets/hero.png'
    );
    expect(getAdminRenderedImagePreviewSrc('/@fs/D:/Server-Related/dev/astro-whono/src/assets/hero.png?origWidth=1200')).toBe(
      '/@fs/D:/Server-Related/dev/astro-whono/src/assets/hero.png?origWidth=1200'
    );
    expect(getAdminRenderedImagePreviewSrc('https://example.com/hero.webp')).toBe('https://example.com/hero.webp');
    expect(getAdminRenderedImagePreviewSrc('http://example.com/hero.webp')).toBeNull();
    expect(getAdminRenderedImagePreviewSrc('data:image/png;base64,hero.png')).toBeNull();
    expect(getAdminRenderedImagePreviewSrc('//example.com/hero.webp')).toBeNull();
    expect(getAdminRenderedImagePreviewSrc('/_astro/hero.hash.png#preview')).toBeNull();
  });

  it('tokenizes search query and builds normalized haystack text', () => {
    expect(tokenizeSearchQuery(' Astro   主题  astro ')).toEqual(['astro', '主题']);
    expect(
      buildSearchHaystack([' Title ', ' Description ', ['TagA', ' TagB '], '', null, 'Body'])
    ).toBe('title description taga tagb body');
  });

  it('canonicalizes admin settings snapshots and reports contract mismatches', () => {
    const raw = structuredClone(getEditableThemeSettingsPayload().settings) as Record<string, any>;
    raw.site.title = `  ${raw.site.title}  `;
    raw.site.footer.startYear = String(raw.site.footer.startYear);
    raw.site.socialLinks.email = `mailto:${raw.site.socialLinks.email}`;
    raw.site.socialLinks.custom = [
      {
        id: 'custom-home',
        label: '',
        href: 'https://example.com',
        iconKey: 'globe',
        visible: 1,
        order: '4'
      }
    ];
    delete raw.page.about.subtitle;

    const canonical = canonicalizeAdminThemeSettings(raw, {
      footerStartYearMax: 2030,
      normalizeCustomSocialLabel: (value, iconKey) => String(value ?? '').trim() || iconKey
    });

    expect(canonical.site.title).toBe(getEditableThemeSettingsPayload().settings.site.title);
    expect(canonical.site.footer.startYear).toBe(getEditableThemeSettingsPayload().settings.site.footer.startYear);
    expect(canonical.site.socialLinks.email).toBe(getEditableThemeSettingsPayload().settings.site.socialLinks.email);
    expect(canonical.site.socialLinks.custom[0]).toMatchObject({
      iconKey: 'website',
      label: 'website',
      visible: true,
      order: 4
    });
    expect(validateAdminThemeSettings(canonical, { footerStartYearMax: 2030 })).toEqual([]);
    expect(
      createAdminThemeSettingsCanonicalMismatchIssues(raw, canonical).map((issue) => issue.path)
    ).toEqual(
      expect.arrayContaining([
        'site.title',
        'site.footer.startYear',
        'site.socialLinks.email',
        'site.socialLinks.custom[0].iconKey',
        'site.socialLinks.custom[0].label',
        'site.socialLinks.custom[0].visible',
        'site.socialLinks.custom[0].order',
        'page.about.subtitle'
      ])
    );
  });

  it('fills compatibility defaults for legacy admin overview and sidebar action snapshots', () => {
    const canonical = getEditableThemeSettingsPayload().settings;
    const legacySnapshot = structuredClone(canonical) as Record<string, any>;
    delete legacySnapshot.site.adminOverview;
    legacySnapshot.ui.sidebarActions = {
      showThemeToggle: canonical.ui.sidebarActions.showThemeToggle
    };

    const compatible = fillAdminThemeSettingsCompatibilityDefaults(
      legacySnapshot,
      canonical
    ) as Record<string, any>;

    const mismatchPaths = createAdminThemeSettingsCanonicalMismatchIssues(compatible, canonical).map((issue) => issue.path);
    expect(mismatchPaths).not.toContain('site.adminOverview');
    expect(mismatchPaths).not.toContain('ui.sidebarActions');
    expect(mismatchPaths).not.toContain('ui.sidebarActions.showRssLink');
    expect(mismatchPaths).not.toContain('ui.sidebarActions.showAdminEntry');
  });

  it('canonicalizes typography font ids against the registry per role', () => {
    const raw = structuredClone(getEditableThemeSettingsPayload().settings) as Record<string, any>;
    raw.ui.typography.readable = 'lxgw-wenkai-lite';
    raw.ui.typography.copy = 'system-mono';
    raw.ui.typography.mono = 'bogus-font';
    raw.ui.typography.brand = 'system-mono';

    const canonical = canonicalizeAdminThemeSettings(raw);

    expect(canonical.ui.typography).toEqual({
      readable: 'lxgw-wenkai-lite',
      copy: 'lxgw-wenkai-lite',
      mono: 'system-mono',
      brand: 'serif-georgia'
    });

    const mismatchPaths = createAdminThemeSettingsCanonicalMismatchIssues(raw, canonical).map((issue) => issue.path);
    expect(mismatchPaths).toEqual(
      expect.arrayContaining(['ui.typography.copy', 'ui.typography.mono', 'ui.typography.brand'])
    );
    expect(mismatchPaths).not.toContain('ui.typography.readable');
  });

  it('fills compatibility defaults for legacy snapshots missing typography', () => {
    const canonical = getEditableThemeSettingsPayload().settings;
    const legacySnapshot = structuredClone(canonical) as Record<string, any>;
    delete legacySnapshot.ui.typography;

    const compatible = fillAdminThemeSettingsCompatibilityDefaults(legacySnapshot, canonical);
    const mismatchPaths = createAdminThemeSettingsCanonicalMismatchIssues(compatible, canonical).map((issue) => issue.path);
    expect(mismatchPaths).not.toContain('ui.typography');

    const partialSnapshot = structuredClone(canonical) as Record<string, any>;
    partialSnapshot.ui.typography = { readable: canonical.ui.typography.readable };
    const partialCompatible = fillAdminThemeSettingsCompatibilityDefaults(partialSnapshot, canonical);
    const partialMismatchPaths = createAdminThemeSettingsCanonicalMismatchIssues(partialCompatible, canonical).map(
      (issue) => issue.path
    );
    expect(partialMismatchPaths).not.toContain('ui.typography.copy');
    expect(partialMismatchPaths).not.toContain('ui.typography.mono');
    expect(partialMismatchPaths).not.toContain('ui.typography.brand');
  });

  it('validates typography font ids per role', () => {
    const settings = structuredClone(getEditableThemeSettingsPayload().settings) as Record<string, any>;
    settings.ui.typography.copy = 'system-mono';
    settings.ui.typography.mono = 'bogus-font';

    const paths = validateAdminThemeSettings(settings as EditableThemeSettings).map((issue) => issue.path);
    expect(paths).toContain('ui.typography.copy');
    expect(paths).toContain('ui.typography.mono');
    expect(paths).not.toContain('ui.typography.readable');
  });

  it('validates admin overview public display settings', () => {
    const settings = structuredClone(getEditableThemeSettingsPayload().settings);
    settings.site.adminOverview.publicVisible = false;
    settings.site.adminOverview.hiddenMessage = '暂未公开';
    settings.ui.sidebarActions.showAdminEntry = true;

    expect(validateAdminThemeSettings(settings)).toEqual([]);

    settings.site.adminOverview.hiddenMessage = '';
    expect(validateAdminThemeSettings(settings).map((issue) => issue.path)).toContain(
      'site.adminOverview.hiddenMessage'
    );
  });

  it('canonicalizes favicon slot paths and keeps invalid inputs for validation', () => {
    const raw = structuredClone(getEditableThemeSettingsPayload().settings) as Record<string, any>;
    raw.site.favicon = {
      svg: null,
      png: ' public/images/site/favicon-64x64-a1b2c3d4.png ',
      appleTouchIcon: 'https://example.com/apple-touch-icon.png'
    };

    const canonical = canonicalizeAdminThemeSettings(raw);

    expect(canonical.site.favicon).toEqual({
      svg: null,
      png: '/images/site/favicon-64x64-a1b2c3d4.png',
      appleTouchIcon: 'https://example.com/apple-touch-icon.png'
    });

    const paths = validateAdminThemeSettings(canonical).map((issue) => issue.path);
    expect(paths).toContain('site.favicon.appleTouchIcon');
    expect(paths).not.toContain('site.favicon.png');
  });

  it('validates favicon file existence through localFileExists', () => {
    const settings = structuredClone(getEditableThemeSettingsPayload().settings);
    settings.site.favicon = {
      svg: null,
      png: '/images/site/favicon-64x64-a1b2c3d4.png',
      appleTouchIcon: null
    };

    const missing = validateAdminThemeSettings(settings, { localFileExists: () => false });
    expect(missing.map((issue) => issue.path)).toContain('site.favicon.png');
    expect(missing.find((issue) => issue.path === 'site.favicon.png')?.message).toContain(
      'public/images/site/favicon-64x64-a1b2c3d4.png'
    );

    const present = validateAdminThemeSettings(settings, { localFileExists: () => true });
    expect(present.map((issue) => issue.path)).not.toContain('site.favicon.png');
  });

  it('fills compatibility defaults for legacy snapshots missing the favicon block', () => {
    const canonical = getEditableThemeSettingsPayload().settings;
    const legacySnapshot = structuredClone(canonical) as Record<string, any>;
    delete legacySnapshot.site.favicon;

    const compatible = fillAdminThemeSettingsCompatibilityDefaults(legacySnapshot, canonical);
    const mismatchPaths = createAdminThemeSettingsCanonicalMismatchIssues(compatible, canonical).map(
      (issue) => issue.path
    );
    expect(mismatchPaths).not.toContain('site.favicon');

    const partialSnapshot = structuredClone(canonical) as Record<string, any>;
    partialSnapshot.site.favicon = { png: canonical.site.favicon.png };
    const partialCompatible = fillAdminThemeSettingsCompatibilityDefaults(partialSnapshot, canonical);
    const partialMismatchPaths = createAdminThemeSettingsCanonicalMismatchIssues(partialCompatible, canonical).map(
      (issue) => issue.path
    );
    expect(partialMismatchPaths).not.toContain('site.favicon.svg');
    expect(partialMismatchPaths).not.toContain('site.favicon.appleTouchIcon');
  });
});
