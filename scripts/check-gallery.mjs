import { readSmokeFixtureHtml, reportSmokeCheckResult } from './smoke-utils.mjs';

const getGalleryBlock = (html) => {
  const match = html.match(
    /<ul[^>]*\bclass="[^"]*\bgallery\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/i
  );
  return match ? match[1] : '';
};

const checks = [
  {
    id: 'gallery.list',
    test: (html) => /<ul[^>]*\bclass="[^"]*\bgallery\b/.test(html)
  },
  {
    id: 'gallery.item',
    test: (html) => /<li[\s>]/i.test(getGalleryBlock(html))
  },
  {
    id: 'gallery.figure',
    test: (html) => /<figure[\s>]/i.test(getGalleryBlock(html))
  },
  {
    id: 'gallery.media',
    test: (html) => /<(img|picture)\b/i.test(getGalleryBlock(html))
  }
];

const html = await readSmokeFixtureHtml('Gallery check');
const failed = checks.filter((item) => !item.test(html)).map((item) => item.id);

reportSmokeCheckResult('Gallery check', failed);
