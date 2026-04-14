import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';

const distDir = path.resolve('dist');
const smokeFixturePath = path.join(distDir, 'checks', 'markdown-smoke', 'index.html');
const ADMIN_OVERVIEW_HEADER_PATTERN = new RegExp([
  '<h1\\b(?=[^>]*\\bclass="[^"]*\\bpage-title\\b[^"]*")[^>]*>\\s*Site Overview\\s*</h1>',
  '<span\\b(?=[^>]*\\bclass="[^"]*\\bpage-subtitle\\b[^"]*")[^>]*>\\s*站点概览\\s*</span>'
].join('\\s*'));

export const expect = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const readSmokeFixtureHtml = async (label) => {
  try {
    return await readFile(smokeFixturePath, 'utf8');
  } catch {
    console.error(`${label} failed: unable to read build output.`);
    console.error(`Expected file: ${smokeFixturePath}`);
    console.error('Run `npm run build` first.');
    process.exit(1);
  }
};

export const reportSmokeCheckResult = (label, failedIds) => {
  if (!failedIds.length) {
    console.log(`${label} passed.`);
    return;
  }

  console.error(`${label} failed:`);
  for (const id of failedIds) {
    console.error(`- missing ${id}`);
  }
  process.exit(1);
};

export const assertStaticRedirectShell = (label, body, expectedPath) => {
  const expectedRedirectText = `Redirecting to: ${expectedPath}`;
  expect(
    body.includes(expectedRedirectText),
    `${label} no longer matches the current static redirect shell`
  );
};

export const assertAdminOverviewHeader = (label, body) => {
  expect(
    ADMIN_OVERVIEW_HEADER_PATTERN.test(body),
    `${label} is missing the visible Site Overview heading and 站点概览 subtitle`
  );
};

export const assertAdminOverviewSectionOrder = (label, body) => {
  const recentIndex = body.indexOf('id="admin-overview-recent"');
  const activityIndex = body.indexOf('id="admin-overview-activity"');
  expect(recentIndex !== -1, `${label} is missing the recent publications section anchor`);
  expect(activityIndex !== -1, `${label} is missing the writing activity section anchor`);
  expect(
    recentIndex < activityIndex,
    `${label} should render recent publications before writing activity`
  );
};

const assertAdminApiStaticShell = (label, body, expectedPath, leakedMarkers) => {
  assertStaticRedirectShell(label, body, expectedPath);
  for (const marker of leakedMarkers) {
    expect(
      !body.includes(marker),
      `${label} leaked API payload marker ${marker} in production preview`
    );
  }
  expect(
    !body.includes('"mode":"readonly"') && !body.includes('"mode": "readonly"'),
    `${label} still looks like the removed production readonly JSON contract`
  );
};

export const assertAdminSettingsStaticShell = (label, body, expectedPath = '/api/admin/settings/') => {
  assertAdminApiStaticShell(label, body, expectedPath, ['"revision"', '"settings"']);
};

export const assertAdminContentStaticShell = (
  label,
  body,
  expectedPath = '/api/admin/content/entry/'
) => {
  assertAdminApiStaticShell(label, body, expectedPath, [
    '"revision"',
    '"writable"',
    '"changedFields"',
    '"frontmatter"'
  ]);
};

export const assertAdminMediaStaticShell = (label, body, expectedPath) => {
  assertAdminApiStaticShell(label, body, expectedPath, [
    '"items"',
    '"mimeType"',
    '"width"',
    '"height"',
    '"previewSrc"'
  ]);
};

export const assertAdminSettingsStaticResponse = (label, response, expectedPath = '/api/admin/settings/') => {
  expect(
    !response.contentType.toLowerCase().includes('application/json'),
    `${label} unexpectedly returned JSON in production preview`
  );
  assertAdminSettingsStaticShell(label, response.body, expectedPath);
};

export const assertAdminContentStaticResponse = (
  label,
  response,
  expectedPath = '/api/admin/content/entry/'
) => {
  expect(
    !response.contentType.toLowerCase().includes('application/json'),
    `${label} unexpectedly returned JSON in production preview`
  );
  assertAdminContentStaticShell(label, response.body, expectedPath);
};

export const assertAdminMediaStaticResponse = (label, response, expectedPath) => {
  expect(
    !response.contentType.toLowerCase().includes('application/json'),
    `${label} unexpectedly returned JSON in production preview`
  );
  assertAdminMediaStaticShell(label, response.body, expectedPath);
};

export const waitForHttpReady = async (url, options = {}) => {
  const { attempts = 50, intervalMs = 200 } = options;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}

    if (attempt === attempts - 1) {
      throw new Error(`Timed out waiting for ${url}`);
    }

    await sleep(intervalMs);
  }
};

const resolveListeningPort = (server) => {
  const address = server.address();
  return address && typeof address === 'object' ? address.port : 0;
};

export const findAvailablePort = (host, preferredPort = 0) =>
  new Promise((resolve, reject) => {
    const listen = (port) => {
      const probe = createServer();
      probe.unref();

      probe.once('error', (error) => {
        probe.close(() => {});
        if ((error?.code === 'EADDRINUSE' || error?.code === 'EACCES') && port !== 0) {
          listen(0);
          return;
        }
        reject(error);
      });

      probe.listen({ host, port }, () => {
        const availablePort = resolveListeningPort(probe);
        probe.close((closeError) => {
          if (closeError) {
            reject(closeError);
            return;
          }
          resolve(availablePort);
        });
      });
    };

    listen(preferredPort);
  });
