import { readSmokeFixtureHtml, reportSmokeCheckResult } from './smoke-utils.mjs';

const checks = [
  {
    id: 'callout.tip',
    pattern: /class="[^"]*\bcallout\b[^"]*\btip\b/
  },
  {
    id: 'callout-title',
    pattern: /class="[^"]*\bcallout-title\b/
  }
];

const html = await readSmokeFixtureHtml('Callout check');
const failed = checks.filter((item) => !item.pattern.test(html)).map((item) => item.id);

reportSmokeCheckResult('Callout check', failed);
