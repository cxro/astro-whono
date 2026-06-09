import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertAdminOverviewHeader,
  assertAdminContentStaticShell,
  assertAdminImageStaticShell,
  assertAdminImageUploadStaticShell,
  assertAdminPreviewStaticShell,
  assertNoAdminRouteNav,
  assertNoDevAdminUiPreferenceChrome,
  assertAdminSettingsStaticShell,
  DEV_ADMIN_UI_PREFERENCE_MARKERS,
  expect
} from './smoke-utils.mjs';

const normalizeSiteUrl = (value) => value.trim().replace(/\/+$/, '');

export const resolveRequiredSiteUrl = () => {
  const siteUrl = normalizeSiteUrl(process.env.SITE_URL ?? '');
  expect(siteUrl.length > 0, 'SITE_URL is required for production artifact verification');
  return siteUrl;
};

const readText = (filePath) => {
  expect(existsSync(filePath), `Expected build artifact is missing: ${filePath}`);
  return readFileSync(filePath, 'utf8');
};

const findAdminContentEditArtifactDirs = () => {
  const root = 'dist/admin/content';
  if (!existsSync(root)) return [];

  const matches = [];
  const walk = (dirPath) => {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.name === '_edit') {
        matches.push(fullPath);
      }
      walk(fullPath);
    }
  };

  walk(root);
  return matches;
};

const findBuiltAstroAssets = () => {
  const root = 'dist/_astro';
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(css|js)$/i.test(entry.name))
    .map((entry) => path.join(root, entry.name));
};

const assertNoDevAdminUiPreferenceAssets = () => {
  for (const filePath of findBuiltAstroAssets()) {
    for (const marker of DEV_ADMIN_UI_PREFERENCE_MARKERS) {
      expect(
        !filePath.includes(marker),
        `${filePath} should not be emitted as a DEV-only admin UI preference asset`
      );
    }
    assertNoDevAdminUiPreferenceChrome(filePath, readText(filePath));
  }
};

const EMOJI_PICKER_ARTIFACT_MARKERS = [
  'emoji-picker-element',
  'emoji-picker-element-data',
  '<emoji-picker'
];

const assertNoEmojiPickerAssets = () => {
  for (const filePath of findBuiltAstroAssets()) {
    const content = readText(filePath);
    for (const marker of EMOJI_PICKER_ARTIFACT_MARKERS) {
      expect(
        !content.includes(marker),
        `${filePath} should not contain emoji picker artifacts (${marker})`
      );
    }
  }
};

const PREV_LINK_PATTERN = /<a class="prev-next__link prev-next__link--prev"[^>]*rel="prev">/;
const NEXT_LINK_PATTERN = /<a class="prev-next__link prev-next__link--next"[^>]*rel="next">/;

export const runProductionArtifactCheck = async (options = {}) => {
  const siteUrl = options.siteUrl ?? resolveRequiredSiteUrl();

  const requiredArtifacts = [
    'dist/sitemap-index.xml',
    'dist/sitemap-0.xml',
    'dist/robots.txt',
    'dist/rss.xml',
    'dist/archive/rss.xml',
    'dist/essay/rss.xml',
    'dist/index.html',
    'dist/about/index.html',
    'dist/admin/index.html',
    'dist/admin/content/index.html',
    'dist/admin/images/index.html',
    'dist/admin/checks/index.html',
    'dist/bits/index.html',
    'dist/admin/data/index.html',
    'dist/admin/theme/index.html',
    'dist/api/admin/settings',
    'dist/api/admin/data/settings',
    'dist/api/admin/content/entry',
    'dist/api/admin/content/create',
    'dist/api/admin/content/export',
    'dist/api/admin/content/delete',
    'dist/api/admin/preview',
    'dist/api/admin/images/list',
    'dist/api/admin/images/meta',
    'dist/api/admin/images/upload'
  ];

  for (const artifactPath of requiredArtifacts) {
    expect(existsSync(artifactPath), `Expected build artifact is missing: ${artifactPath}`);
  }

  const robotsTxt = readText('dist/robots.txt');
  expect(
    robotsTxt.includes(`Sitemap: ${siteUrl}/sitemap-index.xml`),
    'robots.txt is missing the expected Sitemap line'
  );

  const sitemapXml = readText('dist/sitemap-0.xml');
  expect(
    sitemapXml.includes(`<loc>${siteUrl}/about/</loc>`),
    'Sitemap is missing the expected /about/ location'
  );
  expect(!sitemapXml.includes('/admin/'), 'Admin route leaked into sitemap');
  expect(!sitemapXml.includes('/admin/theme/'), 'Admin theme route leaked into sitemap');
  expect(!sitemapXml.includes('/admin/content/'), 'Admin content route leaked into sitemap');
  expect(!sitemapXml.includes('/admin/images/'), 'Admin images route leaked into sitemap');
  expect(!sitemapXml.includes('/admin/checks/'), 'Admin checks route leaked into sitemap');
  expect(!sitemapXml.includes('/admin/data/'), 'Admin data route leaked into sitemap');
  expect(
    !sitemapXml.includes(`${siteUrl}/bits/draft-dialog/`),
    'Bits draft partial route leaked into sitemap'
  );

  const sitemapLocs = Array.from(
    sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g),
    (match) => match[1].trim()
  ).filter(Boolean);
  const leakedEssayDetail = sitemapLocs.find((loc) => /^\/essay\/[^/]+\/$/.test(new URL(loc).pathname));
  expect(!leakedEssayDetail, `Essay compatibility redirect leaked into sitemap: ${leakedEssayDetail}`);

  assertNoEmojiPickerAssets();

  const aboutHtml = readText('dist/about/index.html');
  expect(
    aboutHtml.includes(`<link rel="canonical" href="${siteUrl}/about/"`),
    'About page canonical no longer matches SITE_URL'
  );
  expect(
    aboutHtml.includes(`<meta property="og:url" content="${siteUrl}/about/"`),
    'About page og:url no longer matches SITE_URL'
  );
  assertNoDevAdminUiPreferenceChrome('dist/about/index.html', aboutHtml);
  expect(!/\.admin-/.test(aboutHtml), 'Public about page still contains admin CSS rules');
  expect(!/--admin-status-/.test(aboutHtml), 'Public about page still contains admin CSS tokens');

  const adminHtml = readText('dist/admin/index.html');
  const adminContentHtml = readText('dist/admin/content/index.html');
  const adminImageHtml = readText('dist/admin/images/index.html');
  const adminChecksHtml = readText('dist/admin/checks/index.html');
  const adminThemeHtml = readText('dist/admin/theme/index.html');
  const adminDataHtml = readText('dist/admin/data/index.html');
  const readonlyAdminHtmlChecks = [
    ['dist/admin/content/index.html', adminContentHtml, 'Content Console'],
    ['dist/admin/images/index.html', adminImageHtml, 'Images Console'],
    ['dist/admin/checks/index.html', adminChecksHtml, 'Checks Console'],
    ['dist/admin/theme/index.html', adminThemeHtml, 'Theme Console'],
    ['dist/admin/data/index.html', adminDataHtml, 'Data Console']
  ];
  [
    'dist/admin/content/essay/index.html',
    'dist/admin/content/bits/index.html',
    'dist/admin/content/memo/index.html'
  ].forEach((filePath) => {
    expect(!existsSync(filePath), `${filePath} should not be generated after collection list routes were removed`);
  });
  const adminContentEditArtifactDirs = findAdminContentEditArtifactDirs();
  expect(
    adminContentEditArtifactDirs.length === 0,
    `Production build should not generate per-entry admin content edit artifacts: ${adminContentEditArtifactDirs.join(', ')}`
  );

  assertAdminOverviewHeader('dist/admin/index.html', adminHtml);
  assertNoDevAdminUiPreferenceChrome('dist/admin/index.html', adminHtml);
  if (adminHtml.includes('data-admin-overview-mode="hidden"')) {
    expect(
      adminHtml.includes('admin-site-overview__hidden-message'),
      'dist/admin/index.html is missing the hidden overview message'
    );
  } else {
    expect(adminHtml.includes('data-admin-overview-mode="public"'), 'dist/admin/index.html is missing the public overview mode marker');
  }
  expect(adminHtml.includes('noindex,nofollow'), 'dist/admin/index.html is missing the noindex robots boundary');
  assertNoAdminRouteNav('dist/admin/index.html', adminHtml);
  expect(!adminHtml.includes('data-admin-root'), 'dist/admin/index.html should stay readonly outside dev');
  expect(!adminHtml.includes('id="admin-bootstrap"'), 'dist/admin/index.html should not emit theme bootstrap payload');
  expect(!adminHtml.includes('data-admin-content-root'), 'dist/admin/index.html should not emit content console payload');
  expect(!adminHtml.includes('data-admin-images-root'), 'dist/admin/index.html should not emit images console payload');
  expect(!adminHtml.includes('id="admin-images-bootstrap"'), 'dist/admin/index.html should not emit images bootstrap payload');
  expect(!adminHtml.includes('data-admin-data-root'), 'dist/admin/index.html should not emit data console payload');
  expect(!adminHtml.includes('id="admin-data-bootstrap"'), 'dist/admin/index.html should not emit data bootstrap payload');
  expect(
    !/<script type="module" src="\/_astro\/[^"]+"><\/script>/.test(adminHtml),
    'dist/admin/index.html still links an external _astro module script'
  );

  for (const [filePath, html, heading] of readonlyAdminHtmlChecks) {
    expect(html.includes(heading), `${filePath} is missing the expected ${heading} route heading`);
    assertNoAdminRouteNav(filePath, html);
    assertNoDevAdminUiPreferenceChrome(filePath, html);
    expect(!html.includes('data-admin-root'), `${filePath} should stay readonly outside dev`);
    expect(!html.includes('id="admin-bootstrap"'), `${filePath} should not emit theme bootstrap payload`);
    expect(!html.includes('data-admin-content-root'), `${filePath} should not emit content console payload`);
    expect(!html.includes('data-admin-images-root'), `${filePath} should not emit images console payload`);
    expect(!html.includes('id="admin-images-bootstrap"'), `${filePath} should not emit images bootstrap payload`);
    expect(!/index@_@astro\.[^"]+\.css/.test(html), `${filePath} still links admin-only CSS`);
    expect(
      !/<script type="module" src="\/_astro\/[^"]+"><\/script>/.test(html),
      `${filePath} still links an external _astro module script`
    );
  }
  assertNoDevAdminUiPreferenceAssets();

  const indexHtml = readText('dist/index.html');
  expect(
    /<h1 class="sr-only">[^<]+<\/h1>/.test(indexHtml),
    'Homepage hidden H1 is missing from dist/index.html'
  );
  assertNoDevAdminUiPreferenceChrome('dist/index.html', indexHtml);
  expect(!/\.admin-/.test(indexHtml), 'Homepage still contains admin CSS rules');
  expect(!/--admin-status-/.test(indexHtml), 'Homepage still contains admin CSS tokens');

  const pageSettings = existsSync('src/data/settings/page.json')
    ? JSON.parse(readFileSync('src/data/settings/page.json', 'utf8'))
    : null;
  const { site } = await import('../site.config.mjs');
  const rawAvatar = pageSettings?.bits?.defaultAuthor?.avatar ?? site.authorAvatar ?? 'author/avatar.webp';
  expect(
    typeof rawAvatar === 'string' && rawAvatar.trim().length > 0,
    'Bits default author avatar is missing from page settings / site config'
  );

  const normalizedAvatar = rawAvatar.trim().replace(/\\/g, '/').replace(/^\.\/+/, '');
  const hasInvalidAvatarPath =
    normalizedAvatar.startsWith('/') ||
    normalizedAvatar.startsWith('//') ||
    normalizedAvatar.startsWith('public/') ||
    /^[A-Za-z]+:\/\//.test(normalizedAvatar) ||
    /(^|\/)\.\.(?:\/|$)/.test(normalizedAvatar) ||
    normalizedAvatar.includes('?') ||
    normalizedAvatar.includes('#');

  expect(
    !hasInvalidAvatarPath,
    `Bits default author avatar must stay a relative public/** image path: ${rawAvatar}`
  );
  expect(
    /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(normalizedAvatar),
    `Bits default author avatar must point to an image file: ${rawAvatar}`
  );

  const avatarFilePath = `public/${normalizedAvatar}`;
  if (!existsSync(avatarFilePath)) {
    console.warn(
      `[check:prod-artifacts] Bits default author avatar points to a missing file; the public UI will fall back to initials: ${avatarFilePath}`
    );
  }

  const getRssItemLinks = (xml) =>
    Array.from(xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g), (match) => match[1].trim()).filter(Boolean);

  const normalizeArchiveDetailPath = (href) => {
    const url = new URL(href);
    const normalizedPath = url.pathname.replace(/\/+$/, '').replace(/^\/+/, '');
    expect(
      normalizedPath.startsWith('archive/') && normalizedPath.split('/').length >= 2,
      `Archive RSS item did not resolve to an /archive/{slug}/ detail page: ${href}`
    );
    return path.join('dist', normalizedPath, 'index.html');
  };

  const defaultRssXml = readText('dist/rss.xml');
  const archiveRssXml = readText('dist/archive/rss.xml');
  const essayRssXml = readText('dist/essay/rss.xml');

  const defaultRssLinks = getRssItemLinks(defaultRssXml);
  const archiveRssLinks = getRssItemLinks(archiveRssXml);
  const essayRssLinks = getRssItemLinks(essayRssXml);

  expect(archiveRssLinks.length > 0, 'Archive RSS does not contain any item links');
  expect(defaultRssLinks.length > 0, 'Default RSS does not contain any item links');
  expect(essayRssLinks.length > 0, 'Essay RSS does not contain any item links');

  const sampleArchiveLink = archiveRssLinks[0];
  expect(
    sampleArchiveLink.startsWith(`${siteUrl}/archive/`),
    `Archive RSS item link is not absolute or not under /archive/: ${sampleArchiveLink}`
  );
  expect(
    defaultRssLinks.includes(sampleArchiveLink),
    `Default RSS is missing archive item link: ${sampleArchiveLink}`
  );
  expect(
    essayRssLinks.includes(sampleArchiveLink),
    `Essay RSS is missing archive item link: ${sampleArchiveLink}`
  );
  expect(
    sitemapXml.includes(`<loc>${sampleArchiveLink}</loc>`),
    `Sitemap is missing archive detail link: ${sampleArchiveLink}`
  );

  const sampleArchiveHtmlPath = normalizeArchiveDetailPath(sampleArchiveLink);
  const sampleArchiveHtml = readText(sampleArchiveHtmlPath);
  expect(
    sampleArchiveHtml.includes(`<link rel="canonical" href="${sampleArchiveLink}"`),
    `Archive detail page canonical does not match RSS item link: ${sampleArchiveLink}`
  );
  expect(
    sampleArchiveHtml.includes(`<meta property="og:url" content="${sampleArchiveLink}"`),
    `Archive detail page og:url does not match RSS item link: ${sampleArchiveLink}`
  );
  expect(
    !/\.admin-/.test(sampleArchiveHtml),
    `Archive detail page still contains admin CSS rules: ${sampleArchiveHtmlPath}`
  );
  expect(
    !/--admin-status-/.test(sampleArchiveHtml),
    `Archive detail page still contains admin CSS tokens: ${sampleArchiveHtmlPath}`
  );

  const latestEssayLink = essayRssLinks[0];
  const latestEssayHtmlPath = normalizeArchiveDetailPath(latestEssayLink);
  const latestEssayHtml = readText(latestEssayHtmlPath);
  expect(
    !PREV_LINK_PATTERN.test(latestEssayHtml),
    `Latest essay detail page should not render a prev link: ${latestEssayHtmlPath}`
  );

  const oldestEssayLink = essayRssLinks.at(-1);
  expect(oldestEssayLink, 'Essay RSS does not contain an oldest item link');
  const oldestEssayHtmlPath = normalizeArchiveDetailPath(oldestEssayLink);
  const oldestEssayHtml = readText(oldestEssayHtmlPath);
  expect(
    !NEXT_LINK_PATTERN.test(oldestEssayHtml),
    `Oldest essay detail page should not render a next link: ${oldestEssayHtmlPath}`
  );

  const adminSettingsArtifact = readText('dist/api/admin/settings');
  assertAdminSettingsStaticShell('dist/api/admin/settings', adminSettingsArtifact);
  const adminDataSettingsArtifact = readText('dist/api/admin/data/settings');
  assertAdminSettingsStaticShell('dist/api/admin/data/settings', adminDataSettingsArtifact, '/api/admin/data/settings/');
  const adminContentEntryArtifact = readText('dist/api/admin/content/entry');
  assertAdminContentStaticShell(
    'dist/api/admin/content/entry',
    adminContentEntryArtifact,
    '/api/admin/content/entry/'
  );
  const adminContentCreateArtifact = readText('dist/api/admin/content/create');
  assertAdminContentStaticShell(
    'dist/api/admin/content/create',
    adminContentCreateArtifact,
    '/api/admin/content/create/'
  );
  const adminContentExportArtifact = readText('dist/api/admin/content/export');
  assertAdminContentStaticShell(
    'dist/api/admin/content/export',
    adminContentExportArtifact,
    '/api/admin/content/export/'
  );
  expect(
    !adminContentExportArtifact.includes('content-disposition')
      && !adminContentExportArtifact.includes('# Admin Console'),
    'dist/api/admin/content/export should not expose source download response data'
  );
  const adminContentDeleteArtifact = readText('dist/api/admin/content/delete');
  assertAdminContentStaticShell(
    'dist/api/admin/content/delete',
    adminContentDeleteArtifact,
    '/api/admin/content/delete/'
  );
  expect(
    !adminContentDeleteArtifact.includes('"trashedPath"')
      && !adminContentDeleteArtifact.includes('.trash/content'),
    'dist/api/admin/content/delete should not expose delete response data'
  );
  const adminPreviewArtifact = readText('dist/api/admin/preview');
  assertAdminPreviewStaticShell(
    'dist/api/admin/preview',
    adminPreviewArtifact,
    '/api/admin/preview/'
  );
  const adminImageListArtifact = readText('dist/api/admin/images/list');
  assertAdminImageStaticShell(
    'dist/api/admin/images/list',
    adminImageListArtifact,
    '/api/admin/images/list/'
  );
  const adminImageMetaArtifact = readText('dist/api/admin/images/meta');
  assertAdminImageStaticShell(
    'dist/api/admin/images/meta',
    adminImageMetaArtifact,
    '/api/admin/images/meta/'
  );
  const adminImageUploadArtifact = readText('dist/api/admin/images/upload');
  assertAdminImageUploadStaticShell(
    'dist/api/admin/images/upload',
    adminImageUploadArtifact,
    '/api/admin/images/upload/'
  );

  console.log('Production artifact verification passed.');
};

const isDirectExecution = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isDirectExecution) {
  try {
    await runProductionArtifactCheck();
  } catch (error) {
    console.error(error instanceof Error && error.stack ? error.stack : error);
    process.exit(1);
  }
}
