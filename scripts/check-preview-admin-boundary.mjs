import { spawn } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { preview } from 'astro';
import {
  assertAdminContentStaticResponse,
  assertAdminMediaStaticResponse,
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
  const { expectDevChecksSummary = false } = options;
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Admin Console'), `${label} is missing the admin overview heading`);
  expect(response.body.includes('/admin/theme/'), `${label} is missing the theme route link`);
  expect(response.body.includes('/admin/media/'), `${label} is missing the media route link`);
  expect(!response.body.includes('data-admin-root'), `${label} should not mount the theme form root`);
  expect(!response.body.includes('id="admin-bootstrap"'), `${label} should not emit theme bootstrap payload`);
  if (expectDevChecksSummary) {
    expect(response.body.includes('打开 Checks Console'), `${label} is missing the checks console action`);
    expect(response.body.includes('check:preview-admin'), `${label} is missing the admin boundary command hint`);
  }
};

const assertReadonlyAdminThemeShell = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Theme Console'), `${label} is missing the theme heading`);
  expect(response.body.includes('/admin/'), `${label} is missing the overview route link`);
  expect(!response.body.includes('data-admin-root'), `${label} should stay readonly outside dev`);
  expect(!response.body.includes('id="admin-bootstrap"'), `${label} should not emit theme bootstrap payload outside dev`);
};

const assertReadonlyAdminDataShell = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Data Console'), `${label} is missing the data heading`);
  expect(response.body.includes('/admin/'), `${label} is missing the overview route link`);
  expect(!response.body.includes('data-admin-data-root'), `${label} should stay readonly outside dev`);
  expect(!response.body.includes('id="admin-data-bootstrap"'), `${label} should not emit data bootstrap payload outside dev`);
};

const assertReadonlyAdminChecksShell = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Checks Console'), `${label} is missing the checks heading`);
  expect(response.body.includes('/admin/'), `${label} is missing the overview route link`);
};

const assertReadonlyAdminMediaShell = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Media Console'), `${label} is missing the media heading`);
  expect(response.body.includes('/admin/'), `${label} is missing the overview route link`);
  expect(!response.body.includes('data-admin-media-root'), `${label} should stay readonly outside dev`);
  expect(!response.body.includes('id="admin-media-bootstrap"'), `${label} should not emit media bootstrap payload outside dev`);
};

const assertReadonlyAdminContentShell = (label, response, linkHref) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Content Console'), `${label} is missing the content heading`);
  expect(response.body.includes(linkHref), `${label} is missing the expected admin route link`);
  expect(!response.body.includes('data-admin-content-root'), `${label} should stay readonly outside dev`);
};

const assertAdminThemeDevBootstrapSafe = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Theme Console'), `${label} is missing the theme heading`);
  expect(response.body.includes('data-admin-root'), `${label} lost the admin console shell`);
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

const assertAdminDataDevShell = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Data Console'), `${label} is missing the data heading`);
  expect(response.body.includes('data-admin-data-root'), `${label} is missing the data console root`);
  expect(response.body.includes('id="admin-data-bootstrap"'), `${label} is missing the data bootstrap payload`);
  expect(response.body.includes('导出 settings 快照'), `${label} is missing the export action`);
};

const assertAdminChecksDevShell = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Checks Console'), `${label} is missing the checks heading`);
  expect(response.body.includes('当前源文件诊断概览'), `${label} is missing the checks summary copy`);
  expect(response.body.includes('/admin/content/'), `${label} is missing the content route link`);
};

const assertAdminMediaDevShell = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Media Console'), `${label} is missing the media heading`);
  expect(response.body.includes('data-admin-media-root'), `${label} is missing the media console root`);
  expect(response.body.includes('id="admin-media-bootstrap"'), `${label} is missing the media bootstrap payload`);
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
    const adminMediaResponse = await request(baseUrl, '/admin/media/');
    const adminChecksResponse = await request(baseUrl, '/admin/checks/');
    const adminDataResponse = await request(baseUrl, '/admin/data/');
    const getResponse = await request(baseUrl, '/api/admin/settings/');
    const exportResponse = await request(baseUrl, '/api/admin/data/settings/');
    const contentGetResponse = await request(baseUrl, '/api/admin/content/entry/');
    const mediaListResponse = await request(baseUrl, '/api/admin/media/list/');
    const mediaMetaResponse = await request(baseUrl, '/api/admin/media/meta/');
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
    assertReadonlyAdminContentShell('Preview GET /admin/content/', adminContentResponse, '/admin/');
    assertReadonlyAdminContentShell('Preview GET /admin/content/essay/', adminEssayContentResponse, '/admin/content/');
    assertReadonlyAdminMediaShell('Preview GET /admin/media/', adminMediaResponse);
    assertReadonlyAdminChecksShell('Preview GET /admin/checks/', adminChecksResponse);
    assertReadonlyAdminDataShell('Preview GET /admin/data/', adminDataResponse);
    assertAdminSettingsStaticResponse('GET /api/admin/settings/', getResponse);
    assertAdminSettingsStaticResponse('GET /api/admin/data/settings/', exportResponse, '/api/admin/data/settings/');
    assertAdminContentStaticResponse('GET /api/admin/content/entry/', contentGetResponse);
    assertAdminMediaStaticResponse('GET /api/admin/media/list/', mediaListResponse, '/api/admin/media/list/');
    assertAdminMediaStaticResponse('GET /api/admin/media/meta/', mediaMetaResponse, '/api/admin/media/meta/');
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

    const exportResponse = await request(baseUrl, '/api/admin/data/settings/');
    const mediaListResponse = await waitForJsonApiReady(
      baseUrl,
      '/api/admin/media/list/?field=bits.images&page=1&limit=10'
    );
    const mediaMetaResponse = await waitForJsonApiReady(
      baseUrl,
      '/api/admin/media/meta/?field=home.heroImageSrc&value=src/assets/hero.png'
    );
    const contentOverviewResponse = await request(baseUrl, '/admin/content/');
    const contentEssayResponse = await request(baseUrl, '/admin/content/essay/');
    const mediaResponse = await request(baseUrl, '/admin/media/');
    const checksResponse = await request(baseUrl, '/admin/checks/');
    expect(exportResponse.status === 200, `Dev GET /api/admin/data/settings/ returned ${exportResponse.status}`);
    expect(
      exportResponse.contentType.toLowerCase().includes('application/json'),
      'Dev GET /api/admin/data/settings/ did not return JSON'
    );
    expect(exportResponse.json?.manifest?.schemaVersion === 1, 'Dev export manifest is missing schemaVersion=1');
    expect(
      Array.isArray(exportResponse.json?.manifest?.includedScopes)
      && exportResponse.json.manifest.includedScopes.includes('settings'),
      'Dev export manifest is missing includedScopes=settings'
    );
    expect(mediaListResponse.status === 200, `Dev GET /api/admin/media/list/ returned ${mediaListResponse.status}`);
    expect(
      mediaListResponse.contentType.toLowerCase().includes('application/json'),
      'Dev GET /api/admin/media/list/ did not return JSON'
    );
    expect(mediaListResponse.json?.ok === true, 'Dev GET /api/admin/media/list/ did not return ok=true');
    expect(
      Array.isArray(mediaListResponse.json?.result?.items) && mediaListResponse.json.result.items.length > 0,
      'Dev GET /api/admin/media/list/ did not return any media items'
    );
    expect(mediaMetaResponse.status === 200, `Dev GET /api/admin/media/meta/ returned ${mediaMetaResponse.status}`);
    expect(
      mediaMetaResponse.contentType.toLowerCase().includes('application/json'),
      'Dev GET /api/admin/media/meta/ did not return JSON'
    );
    expect(mediaMetaResponse.json?.ok === true, 'Dev GET /api/admin/media/meta/ did not return ok=true');
    expect(mediaMetaResponse.json?.result?.kind === 'local', 'Dev GET /api/admin/media/meta/ did not resolve a local image');
    expect(
      typeof mediaMetaResponse.json?.result?.width === 'number' && mediaMetaResponse.json.result.width > 0,
      'Dev GET /api/admin/media/meta/ did not return a valid width'
    );
    expect(
      typeof mediaMetaResponse.json?.result?.height === 'number' && mediaMetaResponse.json.result.height > 0,
      'Dev GET /api/admin/media/meta/ did not return a valid height'
    );
    expect(contentOverviewResponse.status === 200, `Dev GET /admin/content/ returned ${contentOverviewResponse.status}`);
    expect(contentOverviewResponse.body.includes('Content Console'), 'Dev GET /admin/content/ is missing the content heading');
    expect(contentOverviewResponse.body.includes('/admin/content/essay/'), 'Dev GET /admin/content/ is missing the essay route link');
    expect(contentEssayResponse.status === 200, `Dev GET /admin/content/essay/ returned ${contentEssayResponse.status}`);
    expect(contentEssayResponse.body.includes('data-admin-content-root'), 'Dev GET /admin/content/essay/ did not mount the content console root');
    assertAdminMediaDevShell('Dev GET /admin/media/', mediaResponse);
    assertAdminChecksDevShell('Dev GET /admin/checks/', checksResponse);
    expect(contentEssayResponse.body.includes('entry.id'), 'Dev GET /admin/content/essay/ is missing readonly detail metadata');
    expect(contentEssayResponse.body.includes('复制路径'), 'Dev GET /admin/content/essay/ is missing the copy-path action');
    expect(
      typeof exportResponse.json?.manifest?.locale === 'string' && exportResponse.json.manifest.locale.length > 0,
      'Dev export manifest is missing locale'
    );
    expect(
      exportResponse.json?.settings && typeof exportResponse.json.settings === 'object',
      'Dev export bundle is missing settings snapshot'
    );

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
    const adminMediaResponse = await request(baseUrl, '/admin/media/');
    const adminDataResponse = await request(baseUrl, '/admin/data/');
    assertAdminOverviewShell('Dev GET /admin/', adminOverviewResponse, {
      expectDevChecksSummary: true
    });
    assertAdminThemeDevBootstrapSafe('Dev GET /admin/theme/', adminThemeResponse);
    assertAdminMediaDevShell('Dev GET /admin/media/', adminMediaResponse);
    assertAdminDataDevShell('Dev GET /admin/data/', adminDataResponse);

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
