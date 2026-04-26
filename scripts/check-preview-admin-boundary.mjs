import { spawn } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { preview } from 'astro';
import {
  assertAdminContentStaticResponse,
  assertAdminImageStaticResponse,
  assertAdminOverviewHeader,
  assertHasAdminRouteNav,
  assertNoAdminRouteNav,
  assertAdminSettingsStaticResponse,
  expect,
  findAvailablePort,
  sleep,
  waitForHttpReady
} from './smoke-utils.mjs';

const projectRoot = path.resolve('.');
const astroCliPath = path.join(projectRoot, 'node_modules', 'astro', 'bin', 'astro.mjs');
const defaultSettingsDir = path.join(projectRoot, 'src', 'data', 'settings');
const previewHost = '127.0.0.1';
const ADMIN_BOOTSTRAP_XSS_SENTINEL = '__ADMIN_BOOTSTRAP_XSS_SENTINEL__';
const ADMIN_BOOTSTRAP_BREAKOUT_PAYLOAD = `</script><script>window.${ADMIN_BOOTSTRAP_XSS_SENTINEL}=1</script>`;

const getRequestedPort = (envName, fallbackPort) => {
  const parsed = Number(process.env[envName] ?? String(fallbackPort));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallbackPort;
};

const request = async (baseUrl, pathname, init = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const bodyText = await response.text();
  let bodyJson = null;
  try {
    bodyJson = JSON.parse(bodyText);
  } catch {}

  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    body: bodyText,
    json: bodyJson
  };
};

const waitForJsonApiReady = async (baseUrl, pathname, options = {}) => {
  const { attempts = 40, intervalMs = 250 } = options;
  let lastResponse = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await request(baseUrl, pathname);
      lastResponse = response;
      if (response.status === 200 && response.contentType.toLowerCase().includes('application/json')) {
        return response;
      }
    } catch {}

    if (attempt < attempts - 1) {
      await sleep(intervalMs);
    }
  }

  const detail = lastResponse
    ? `last status=${lastResponse.status}, content-type=${lastResponse.contentType}`
    : 'no response received';
  throw new Error(`Timed out waiting for JSON API ${pathname}: ${detail}`);
};

const resolvePreviewPort = (server, fallbackPort) => {
  const address = server?.server?.address?.();
  return address && typeof address === 'object' ? address.port : fallbackPort;
};

const createTempSettingsFixture = async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-admin-settings-'));
  const settingsDir = path.join(tempRoot, 'settings');
  await cp(defaultSettingsDir, settingsDir, { recursive: true });
  return {
    tempRoot,
    settingsDir,
    cleanup: () => rm(tempRoot, { recursive: true, force: true })
  };
};

const createJsonRequestInit = (baseUrl, payload) => ({
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    origin: baseUrl
  },
  body: JSON.stringify(payload)
});

const assertAdminOverviewShell = (label, response, options = {}) => {
  const { expectMaintainerView = false } = options;
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  assertAdminOverviewHeader(label, response.body);
  expect(!response.body.includes('data-admin-root'), `${label} should not mount the theme form root`);
  expect(!response.body.includes('id="admin-bootstrap"'), `${label} should not emit theme bootstrap payload`);
  expect(!response.body.includes('data-admin-content-root'), `${label} should not emit content console payload`);
  expect(!response.body.includes('data-admin-images-root'), `${label} should not emit images console payload`);
  expect(!response.body.includes('id="admin-images-bootstrap"'), `${label} should not emit images bootstrap payload`);
  expect(!response.body.includes('data-admin-data-root'), `${label} should not emit data console payload`);
  expect(!response.body.includes('id="admin-data-bootstrap"'), `${label} should not emit data bootstrap payload`);

  if (expectMaintainerView) {
    assertHasAdminRouteNav(label, response.body);
    expect(
      response.body.includes('data-admin-overview-mode="maintainer"'),
      `${label} is missing the maintainer overview mode marker`
    );
  } else {
    assertNoAdminRouteNav(label, response.body);
    expect(
      response.body.includes('data-admin-overview-mode="public"')
        || response.body.includes('data-admin-overview-mode="hidden"'),
      `${label} is missing the public or hidden overview mode marker`
    );
  }
};

const assertReadonlyAdminThemeShell = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Theme Console'), `${label} is missing the Theme Console route heading`);
  assertNoAdminRouteNav(label, response.body);
  expect(!response.body.includes('data-admin-root'), `${label} should stay readonly outside dev`);
  expect(!response.body.includes('id="admin-bootstrap"'), `${label} should not emit theme bootstrap payload outside dev`);
};

const assertReadonlyAdminDataShell = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Data Console'), `${label} is missing the Data Console route heading`);
  assertNoAdminRouteNav(label, response.body);
  expect(!response.body.includes('data-admin-data-root'), `${label} should stay readonly outside dev`);
  expect(!response.body.includes('id="admin-data-bootstrap"'), `${label} should not emit data bootstrap payload outside dev`);
};

const assertReadonlyAdminChecksShell = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Checks Console'), `${label} is missing the Checks Console route heading`);
  assertNoAdminRouteNav(label, response.body);
};

const assertReadonlyAdminImageShell = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Images Console'), `${label} is missing the Images Console route heading`);
  assertNoAdminRouteNav(label, response.body);
  expect(!response.body.includes('data-admin-images-root'), `${label} should stay readonly outside dev`);
  expect(!response.body.includes('id="admin-images-bootstrap"'), `${label} should not emit images bootstrap payload outside dev`);
};

const assertAdminContentPlaceholderShell = (label, response, options = {}) => {
  const { expectNav = false } = options;
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Content Console'), `${label} is missing the Content Console route heading`);
  expect(
    response.body.includes('后台文章管理与可视化写作正在开发中'),
    `${label} is missing the Content Console development notice`
  );
  if (expectNav) {
    assertHasAdminRouteNav(label, response.body);
  } else {
    assertNoAdminRouteNav(label, response.body);
  }
  expect(!response.body.includes('data-admin-content-root'), `${label} should stay readonly outside dev`);
};

const assertAdminThemeDevBootstrapSafe = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('data-admin-root'), `${label} lost the admin console shell`);
  assertHasAdminRouteNav(label, response.body);
  expect(response.body.includes('id="admin-bootstrap"'), `${label} is missing the bootstrap container`);
  expect(
    response.body.includes(ADMIN_BOOTSTRAP_XSS_SENTINEL),
    `${label} did not include the stored sentinel in bootstrap output`
  );
  expect(
    !response.body.includes(ADMIN_BOOTSTRAP_BREAKOUT_PAYLOAD),
    `${label} bootstrap still emits raw </script> breakout payload`
  );
  expect(
    !response.body.includes(`<script>window.${ADMIN_BOOTSTRAP_XSS_SENTINEL}=1</script>`),
    `${label} bootstrap still emits an executable sentinel script tag`
  );
};

const stopProcess = async (child) => {
  if (!child || child.exitCode !== null) return;

  child.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (child.exitCode !== null) return;
    await sleep(100);
  }

  child.kill('SIGKILL');
};

export const runPreviewAdminBoundaryCheck = async () => {
  const requestedPort = getRequestedPort('CI_PREVIEW_PORT', 4323);
  const availablePort = await findAvailablePort(previewHost, requestedPort);
  if (availablePort !== requestedPort) {
    console.warn(
      `[check:preview-admin] Port ${requestedPort} is unavailable; using ${availablePort} instead.`
    );
  }

  const server = await preview({
    server: {
      host: previewHost,
      port: availablePort
    }
  });

  const previewPort = resolvePreviewPort(server, availablePort);
  const baseUrl = `http://${previewHost}:${previewPort}`;

  try {
    await waitForHttpReady(`${baseUrl}/`);

    const adminOverviewResponse = await request(baseUrl, '/admin/');
    const adminThemeResponse = await request(baseUrl, '/admin/theme/');
    const adminContentResponse = await request(baseUrl, '/admin/content/');
    const adminEssayContentResponse = await request(baseUrl, '/admin/content/essay/');
    const adminImageResponse = await request(baseUrl, '/admin/images/');
    const adminChecksResponse = await request(baseUrl, '/admin/checks/');
    const adminDataResponse = await request(baseUrl, '/admin/data/');
    const getResponse = await request(baseUrl, '/api/admin/settings/');
    const exportResponse = await request(baseUrl, '/api/admin/data/settings/');
    const contentGetResponse = await request(baseUrl, '/api/admin/content/entry/');
    const imageListResponse = await request(baseUrl, '/api/admin/images/list/');
    const imageMetaResponse = await request(baseUrl, '/api/admin/images/meta/');
    const contentPostResponse = await request(baseUrl, '/api/admin/content/entry/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: baseUrl
      },
      body: JSON.stringify({
        collection: 'essay',
        entryId: 'preview-boundary-demo',
        revision: 'invalid',
        frontmatter: {}
      })
    });
    const postResponse = await request(baseUrl, '/api/admin/settings/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: baseUrl
      },
      body: JSON.stringify({ revision: 'invalid', settings: {} })
    });

    assertAdminOverviewShell('Preview GET /admin/', adminOverviewResponse);
    assertReadonlyAdminThemeShell('Preview GET /admin/theme/', adminThemeResponse);
    assertAdminContentPlaceholderShell('Preview GET /admin/content/', adminContentResponse);
    assertAdminContentPlaceholderShell('Preview GET /admin/content/essay/', adminEssayContentResponse);
    assertReadonlyAdminImageShell('Preview GET /admin/images/', adminImageResponse);
    assertReadonlyAdminChecksShell('Preview GET /admin/checks/', adminChecksResponse);
    assertReadonlyAdminDataShell('Preview GET /admin/data/', adminDataResponse);
    assertAdminSettingsStaticResponse('GET /api/admin/settings/', getResponse);
    assertAdminSettingsStaticResponse('GET /api/admin/data/settings/', exportResponse, '/api/admin/data/settings/');
    assertAdminContentStaticResponse('GET /api/admin/content/entry/', contentGetResponse);
    assertAdminImageStaticResponse('GET /api/admin/images/list/', imageListResponse, '/api/admin/images/list/');
    assertAdminImageStaticResponse('GET /api/admin/images/meta/', imageMetaResponse, '/api/admin/images/meta/');
    assertAdminContentStaticResponse('POST /api/admin/content/entry/', contentPostResponse);
    assertAdminSettingsStaticResponse('POST /api/admin/settings/', postResponse);
    console.log('Preview admin boundary check passed.');
  } finally {
    await server.stop();
  }
};

export const runDevAdminSettingsSmokeCheck = async () => {
  const fixture = await createTempSettingsFixture();
  const requestedPort = getRequestedPort('CI_DEV_ADMIN_PORT', 4324);
  const availablePort = await findAvailablePort(previewHost, requestedPort);
  const baseUrl = `http://${previewHost}:${availablePort}`;
  let stdout = '';
  let stderr = '';
  const child = spawn(process.execPath, [astroCliPath, 'dev', '--host', previewHost, '--port', String(availablePort)], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      ASTRO_WHONO_INTERNAL_TEST_SETTINGS: '1',
      ASTRO_WHONO_INTERNAL_TEST_SETTINGS_DIR: fixture.settingsDir
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });

  try {
    await waitForHttpReady(`${baseUrl}/`, { attempts: 75, intervalMs: 200 });

    const getResponse = await waitForJsonApiReady(baseUrl, '/api/admin/settings/');
    expect(getResponse.status === 200, `Dev GET /api/admin/settings/ returned ${getResponse.status}`);
    expect(
      getResponse.contentType.toLowerCase().includes('application/json'),
      'Dev GET /api/admin/settings/ did not return JSON'
    );
    expect(getResponse.json?.ok === true, 'Dev GET /api/admin/settings/ did not return editable payload');

    const payload = getResponse.json?.payload;
    expect(payload && typeof payload === 'object', 'Dev GET /api/admin/settings/ payload is missing');
    expect(typeof payload.revision === 'string' && payload.revision.length > 0, 'Dev payload revision is missing');
    expect(payload.settings && typeof payload.settings === 'object', 'Dev payload settings snapshot is missing');

    const contentOverviewResponse = await request(baseUrl, '/admin/content/');
    const contentEssayResponse = await request(baseUrl, '/admin/content/essay/');
    assertAdminContentPlaceholderShell('Dev GET /admin/content/', contentOverviewResponse, { expectNav: true });
    assertAdminContentPlaceholderShell('Dev GET /admin/content/essay/', contentEssayResponse, { expectNav: true });

    const uiSettingsPath = path.join(fixture.settingsDir, 'ui.json');
    const beforeDryRun = await readFile(uiSettingsPath, 'utf8');
    const dryRunSettings = structuredClone(payload.settings);
    dryRunSettings.ui.readingMode.showEntry = !dryRunSettings.ui.readingMode.showEntry;
    dryRunSettings.page.about.subtitle = ADMIN_BOOTSTRAP_BREAKOUT_PAYLOAD;

    const dryRunResponse = await request(
      baseUrl,
      '/api/admin/settings/?dryRun=1',
      createJsonRequestInit(baseUrl, {
        revision: payload.revision,
        settings: dryRunSettings
      })
    );

    expect(dryRunResponse.status === 200, `Dev POST ?dryRun=1 returned ${dryRunResponse.status}`);
    expect(dryRunResponse.json?.ok === true, 'Dev POST ?dryRun=1 did not succeed');
    expect(dryRunResponse.json?.dryRun === true, 'Dev POST ?dryRun=1 did not mark dryRun=true');
    expect(dryRunResponse.json?.results?.ui?.changed === true, 'Dev POST ?dryRun=1 did not detect ui changes');

    const afterDryRun = await readFile(uiSettingsPath, 'utf8');
    expect(afterDryRun === beforeDryRun, 'Dev POST ?dryRun=1 unexpectedly mutated ui.json');

    const saveResponse = await request(
      baseUrl,
      '/api/admin/settings/',
      createJsonRequestInit(baseUrl, {
        revision: payload.revision,
        settings: dryRunSettings
      })
    );

    expect(saveResponse.status === 200, `Dev POST /api/admin/settings/ returned ${saveResponse.status}`);
    expect(saveResponse.json?.ok === true, 'Dev POST /api/admin/settings/ did not succeed');
    expect(saveResponse.json?.results?.ui?.changed === true, 'Dev POST /api/admin/settings/ did not report ui change');
    expect(saveResponse.json?.results?.ui?.written === true, 'Dev POST /api/admin/settings/ did not write ui.json');
    expect(
      saveResponse.json?.payload?.settings?.ui?.readingMode?.showEntry === dryRunSettings.ui.readingMode.showEntry,
      'Dev POST /api/admin/settings/ did not return updated payload'
    );
    expect(
      saveResponse.json?.payload?.settings?.page?.about?.subtitle === ADMIN_BOOTSTRAP_BREAKOUT_PAYLOAD,
      'Dev POST /api/admin/settings/ did not persist the bootstrap regression payload'
    );

    const afterSave = await readFile(uiSettingsPath, 'utf8');
    expect(afterSave !== beforeDryRun, 'Dev POST /api/admin/settings/ did not update ui.json');
    expect(
      afterSave.includes(`"showEntry": ${dryRunSettings.ui.readingMode.showEntry}`),
      'Dev POST /api/admin/settings/ wrote unexpected ui.json content'
    );

    const adminOverviewResponse = await request(baseUrl, '/admin/');
    const adminThemeResponse = await request(baseUrl, '/admin/theme/');
    assertAdminOverviewShell('Dev GET /admin/', adminOverviewResponse, {
      expectMaintainerView: true
    });
    assertAdminThemeDevBootstrapSafe('Dev GET /admin/theme/', adminThemeResponse);

    console.log('Dev admin settings smoke check passed.');
  } catch (error) {
    const logs = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
    if (logs) {
      console.error(logs);
    }
    throw error;
  } finally {
    await stopProcess(child);
    await fixture.cleanup();
  }
};

export const runAdminBoundaryChecks = async () => {
  await runPreviewAdminBoundaryCheck();
  await runDevAdminSettingsSmokeCheck();
};

const isDirectExecution = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isDirectExecution) {
  try {
    await runAdminBoundaryChecks();
  } catch (error) {
    console.error(error instanceof Error && error.stack ? error.stack : error);
    process.exit(1);
  }
}
