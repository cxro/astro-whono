import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertAdminOverviewHeader,
  assertAdminOverviewSectionOrder,
  assertAdminContentStaticShell,
  assertAdminMediaStaticShell,
  assertAdminSettingsStaticShell,
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
    'dist/admin/content/essay/index.html',
    'dist/admin/content/bits/index.html',
    'dist/admin/content/memo/index.html',
    'dist/admin/media/index.html',
    'dist/admin/checks/index.html',
    'dist/bits/index.html',
    'dist/admin/data/index.html',
    'dist/admin/theme/index.html',
    'dist/api/admin/settings',
    'dist/api/admin/data/settings',
    'dist/api/admin/content/entry',
    'dist/api/admin/media/list',
    'dist/api/admin/media/meta'
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
  expect(!sitemapXml.includes('/admin/media/'), 'Admin media route leaked into sitemap');
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

  const aboutHtml = readText('dist/about/index.html');
  expect(
    aboutHtml.includes(`<link rel="canonical" href="${siteUrl}/about/"`),
    'About page canonical no longer matches SITE_URL'
  );
  expect(
    aboutHtml.includes(`<meta property="og:url" content="${siteUrl}/about/"`),
    'About page og:url no longer matches SITE_URL'
  );
  expect(!/\.admin-/.test(aboutHtml), 'Public about page still contains admin CSS rules');
  expect(!/--admin-status-/.test(aboutHtml), 'Public about page still contains admin CSS tokens');

  const adminHtml = readText('dist/admin/index.html');
  const adminContentHtml = readText('dist/admin/content/index.html');
  const adminContentEssayHtml = readText('dist/admin/content/essay/index.html');
  const adminContentBitsHtml = readText('dist/admin/content/bits/index.html');
  const adminContentMemoHtml = readText('dist/admin/content/memo/index.html');
  const adminMediaHtml = readText('dist/admin/media/index.html');
  const adminChecksHtml = readText('dist/admin/checks/index.html');
  const adminThemeHtml = readText('dist/admin/theme/index.html');
  const adminDataHtml = readText('dist/admin/data/index.html');
  const readonlyAdminHtmlChecks = [
    ['dist/admin/content/index.html', adminContentHtml, 'Content Console', '/admin/'],
    ['dist/admin/content/essay/index.html', adminContentEssayHtml, 'Content Console', '/admin/content/'],
    ['dist/admin/content/bits/index.html', adminContentBitsHtml, 'Content Console', '/admin/content/'],
    ['dist/admin/content/memo/index.html', adminContentMemoHtml, 'Content Console', '/admin/content/'],
    ['dist/admin/media/index.html', adminMediaHtml, 'Media Console', '/admin/'],
    ['dist/admin/checks/index.html', adminChecksHtml, 'Checks Console', '/admin/'],
    ['dist/admin/theme/index.html', adminThemeHtml, 'Theme Console', '/admin/'],
    ['dist/admin/data/index.html', adminDataHtml, 'Data Console', '/admin/']
  ];

  assertAdminOverviewHeader('dist/admin/index.html', adminHtml);
  expect(!adminHtml.includes('Published'), 'dist/admin/index.html should not show the old English published metric');
  expect(!adminHtml.includes('Last Update'), 'dist/admin/index.html should not show the old English last update metric');
  expect(!adminHtml.includes('Archive Years'), 'dist/admin/index.html should not show the removed archive years metric');
  if (adminHtml.includes('data-admin-overview-mode="hidden"')) {
    expect(adminHtml.includes('暂未公开'), 'dist/admin/index.html is missing the hidden overview mode chip');
    expect(
      adminHtml.includes('admin-site-overview__hidden-message'),
      'dist/admin/index.html is missing the hidden overview message'
    );
    expect(!adminHtml.includes('文章数量'), 'dist/admin/index.html should not show metrics while overview is hidden');
    expect(!adminHtml.includes('内容结构'), 'dist/admin/index.html should not show structure while overview is hidden');
    expect(!adminHtml.includes('近期发布'), 'dist/admin/index.html should not show recent publications while overview is hidden');
    expect(!adminHtml.includes('/admin/theme/'), 'dist/admin/index.html should not show admin route nav while overview is hidden');
  } else {
    expect(adminHtml.includes('文章数量'), 'dist/admin/index.html is missing the article count metric');
    expect(adminHtml.includes('标签数量'), 'dist/admin/index.html is missing the tag count metric');
    expect(adminHtml.includes('文字统计'), 'dist/admin/index.html is missing the word count metric');
    expect(adminHtml.includes('上次更新'), 'dist/admin/index.html is missing the last update metric');
    expect(adminHtml.includes('内容结构'), 'dist/admin/index.html is missing the content structure section');
    expect(adminHtml.includes('写作活动'), 'dist/admin/index.html is missing the writing activity section');
    expect(adminHtml.includes('近期发布'), 'dist/admin/index.html is missing the recent publications section');
    expect(adminHtml.includes('data-admin-overview-mode="public"'), 'dist/admin/index.html is missing the public overview mode marker');
    expect(!adminHtml.includes('公开视图'), 'dist/admin/index.html should not show the old public recent label');
    assertAdminOverviewSectionOrder('dist/admin/index.html', adminHtml);
    expect(adminHtml.includes('/admin/theme/'), 'dist/admin/index.html is missing the admin route nav');
  }
  expect(adminHtml.includes('noindex,nofollow'), 'dist/admin/index.html is missing the noindex robots boundary');
  expect(!adminHtml.includes('data-admin-root'), 'dist/admin/index.html should stay readonly outside dev');
  expect(!adminHtml.includes('id="admin-bootstrap"'), 'dist/admin/index.html should not emit theme bootstrap payload');
  expect(!adminHtml.includes('data-admin-content-root'), 'dist/admin/index.html should not emit content console payload');
  expect(!adminHtml.includes('data-admin-media-root'), 'dist/admin/index.html should not emit media console payload');
  expect(!adminHtml.includes('id="admin-media-bootstrap"'), 'dist/admin/index.html should not emit media bootstrap payload');
  expect(!adminHtml.includes('data-admin-data-root'), 'dist/admin/index.html should not emit data console payload');
  expect(!adminHtml.includes('id="admin-data-bootstrap"'), 'dist/admin/index.html should not emit data bootstrap payload');
  expect(!adminHtml.includes('Readonly Boundary'), 'dist/admin/index.html should not keep the old readonly boundary card');
  expect(!adminHtml.includes('Phase 1'), 'dist/admin/index.html should not keep old Phase 1 copy');
  expect(!adminHtml.includes('Phase 2A'), 'dist/admin/index.html should not keep old Phase 2A copy');
  expect(!adminHtml.includes('后台入口继续保留'), 'dist/admin/index.html should not keep old admin entry copy');
  expect(!adminHtml.includes('打开 Checks Console'), 'dist/admin/index.html should not keep the old checks action');
  expect(!adminHtml.includes('check:preview-admin'), 'dist/admin/index.html should not keep the old boundary command hint');
  expect(
    !/<script type="module" src="\/_astro\/[^"]+"><\/script>/.test(adminHtml),
    'dist/admin/index.html still links an external _astro module script'
  );

  for (const [filePath, html, heading, linkHref] of readonlyAdminHtmlChecks) {
    expect(html.includes(heading), `${filePath} is missing the expected readonly heading`);
    expect(html.includes(linkHref), `${filePath} is missing the expected admin route link`);
    expect(!html.includes('data-admin-root'), `${filePath} should stay readonly outside dev`);
    expect(!html.includes('id="admin-bootstrap"'), `${filePath} should not emit theme bootstrap payload`);
    expect(!html.includes('data-admin-content-root'), `${filePath} should not emit content console payload`);
    expect(!html.includes('data-admin-media-root'), `${filePath} should not emit media console payload`);
    expect(!html.includes('id="admin-media-bootstrap"'), `${filePath} should not emit media bootstrap payload`);
    expect(!/index@_@astro\.[^"]+\.css/.test(html), `${filePath} still links admin-only CSS`);
    expect(
      !/<script type="module" src="\/_astro\/[^"]+"><\/script>/.test(html),
      `${filePath} still links an external _astro module script`
    );
  }

  const indexHtml = readText('dist/index.html');
  expect(
    /<h1 class="sr-only">[^<]+<\/h1>/.test(indexHtml),
    'Homepage hidden H1 is missing from dist/index.html'
  );
  expect(
    /\.sr-only\s*\{/.test(indexHtml),
    'Homepage critical CSS is missing the .sr-only rule'
  );
  if (/class="list-item__excerpt"/.test(indexHtml)) {
    expect(
      /\.list-item__excerpt\s*\{/.test(indexHtml),
      'Homepage critical CSS is missing the .list-item__excerpt rule for above-the-fold entries'
    );
  }
  if (/class="meta-line meta-line--items"/.test(indexHtml)) {
    const requiredHomeMetaRules = [
      [/\.meta-line\s*\{/, 'Homepage critical CSS is missing the .meta-line rule for above-the-fold entries'],
      [/\.meta-line--items\s*\{/, 'Homepage critical CSS is missing the .meta-line--items rule for above-the-fold entries'],
      [/\.meta-line__item\s*\{/, 'Homepage critical CSS is missing the .meta-line__item rule for above-the-fold entries'],
      [/\.meta-line__item--tags\s*\{/, 'Homepage critical CSS is missing the .meta-line__item--tags rule for above-the-fold entries'],
      [
        /\.meta-line__item\s*\+\s*\.meta-line__item::before\s*\{/,
        'Homepage critical CSS is missing the .meta-line__item + .meta-line__item::before separator rule'
      ],
      [/\.list-item\s+\.meta-line\s*\{/, 'Homepage critical CSS is missing the .list-item .meta-line spacing rule'],
      [/\.meta-line\s+\.tag\s*\{/, 'Homepage critical CSS is missing the .meta-line .tag color rule']
    ];

    for (const [pattern, message] of requiredHomeMetaRules) {
      expect(pattern.test(indexHtml), message);
    }
  }
  if (/class="list-item list-item--link"/.test(indexHtml)) {
    expect(
      /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.list-item\s*\{\s*padding:\s*16px\s+0;/.test(indexHtml),
      'Homepage critical CSS is missing the mobile .list-item spacing rule for above-the-fold entries'
    );
  }
  expect(
    /<link(?=[^>]+rel="preload")(?=[^>]+href="[^"]*global[^"]*")(?=[^>]+as="style")[^>]*>/.test(indexHtml),
    'Homepage is no longer preloading the deferred global stylesheet'
  );
  expect(
    /<link(?=[^>]+rel="stylesheet")(?=[^>]+href="[^"]*global[^"]*")(?=[^>]+media="print")(?=[^>]+onload="this\.onload=null;this\.media='all'")[^>]*>/.test(indexHtml),
    'Homepage is no longer using the deferGlobalStyles media-swap stylesheet path'
  );

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
  expect(
    existsSync(avatarFilePath),
    `Bits default author avatar points to a missing file: ${avatarFilePath}`
  );

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
  const adminMediaListArtifact = readText('dist/api/admin/media/list');
  assertAdminMediaStaticShell(
    'dist/api/admin/media/list',
    adminMediaListArtifact,
    '/api/admin/media/list/'
  );
  const adminMediaMetaArtifact = readText('dist/api/admin/media/meta');
  assertAdminMediaStaticShell(
    'dist/api/admin/media/meta',
    adminMediaMetaArtifact,
    '/api/admin/media/meta/'
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
