import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';

const distDir = path.resolve('dist');
const smokeFixturePath = path.join(
  distDir,
  'checks',
  'markdown-smoke',
  'index.html'
);
const ADMIN_SETTINGS_REDIRECT_TEXT = 'Redirecting to: /api/admin/settings/';

export const expect = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const readSmokeFixtureHtml = async (label) => {
  try {
    return await readFile(smokeFixturePath, 'utf8');
  } catch {
    throw new Error(
      `${label} failed: unable to read build output. Expected file: ${smokeFixturePath}. Run \`npm run build\` first.`
    );
  }
};

export const reportSmokeCheckResult = (label, failedIds) => {
  if (!failedIds.length) {
    return;
  }

  throw new Error(
    `${label} failed:\n${failedIds.map((id) => `- missing ${id}`).join('\n')}`
  );
};

export const assertAdminSettingsStaticShell = (label, body) => {
  expect(
    body.includes(ADMIN_SETTINGS_REDIRECT_TEXT),
    `${label} no longer matches the current static redirect shell`
  );
  expect(
    !body.includes('"revision"') && !body.includes('"settings"'),
    `${label} leaked editable Theme Console payload in production preview`
  );
  expect(
    !body.includes('"mode":"readonly"') && !body.includes('"mode": "readonly"'),
    `${label} still looks like the removed production readonly JSON contract`
  );
};

export const assertAdminSettingsStaticResponse = (label, response) => {
  expect(
    !response.contentType.toLowerCase().includes('application/json'),
    `${label} unexpectedly returned JSON in production preview`
  );
  assertAdminSettingsStaticShell(label, response.body);
};

export const waitForHttpReady = async (url, options = {}) => {
  const { attempts = 50, intervalMs = 200 } = options;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore transient failures
    }

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
        if (
          (error?.code === 'EADDRINUSE' || error?.code === 'EACCES') &&
          port !== 0
        ) {
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
