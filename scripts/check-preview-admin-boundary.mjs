import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { preview } from 'astro';
import {
  assertAdminContentStaticResponse,
  assertAdminImageStaticResponse,
  assertAdminImageUploadStaticResponse,
  assertAdminPreviewStaticResponse,
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
const ADMIN_CONTENT_SMOKE_ENTRY_ID = 'admin-console-guide';
const ADMIN_CONTENT_BITS_SMOKE_ENTRY_ID = 'preview-admin-bit';
const ADMIN_CONTENT_MEMO_SMOKE_ENTRY_ID = 'index';
const ADMIN_CONTENT_ABOUT_SMOKE_ENTRY_ID = 'index';
const ADMIN_CONTENT_SMOKE_INITIAL_TITLE = 'Admin Content HTTP Smoke';
const ADMIN_CONTENT_SMOKE_UPDATED_TITLE = 'Admin Content HTTP Smoke Updated';
const ADMIN_CONTENT_BITS_SMOKE_INITIAL_TITLE = 'Admin Bits HTTP Smoke';
const ADMIN_CONTENT_MEMO_SMOKE_INITIAL_TITLE = 'Admin Memo HTTP Smoke';
const ADMIN_CONTENT_ABOUT_SMOKE_BODY_MARKER = 'Admin About HTTP Smoke';
const previewHost = '127.0.0.1';
const ADMIN_BOOTSTRAP_XSS_SENTINEL = '__ADMIN_BOOTSTRAP_XSS_SENTINEL__';
const ADMIN_BOOTSTRAP_BREAKOUT_PAYLOAD = `</script><script>window.${ADMIN_BOOTSTRAP_XSS_SENTINEL}=1</script>`;
const ADMIN_CONTENT_LOCAL_DEV_NOTICE = '若需查看或编辑内容索引';

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

const createAdminContentSmokeSource = () => [
  '---',
  `title: ${ADMIN_CONTENT_SMOKE_INITIAL_TITLE}`,
  'description: Dev HTTP content write smoke fixture',
  'date: 2026-05-01',
  'tags:',
  '  - admin',
  '  - smoke',
  'draft: false',
  'archive: true',
  '---',
  '',
  '# Admin Content HTTP Smoke',
  '',
  'Initial body.',
  ''
].join('\n');

const createAdminBitsSmokeSource = () => [
  '---',
  `title: ${ADMIN_CONTENT_BITS_SMOKE_INITIAL_TITLE}`,
  'description: Dev HTTP bits write smoke fixture',
  'date: 2026-05-02T09:30:00+08:00',
  'tags:',
  '  - admin',
  '  - smoke',
  'draft: false',
  'images:',
  '  - src: bits/preview-admin-smoke.webp',
  '    width: 800',
  '    height: 600',
  '    alt: Preview admin smoke',
  '---',
  '',
  'Initial bits body.',
  ''
].join('\n');

const createAdminMemoSmokeSource = () => [
  '---',
  `title: ${ADMIN_CONTENT_MEMO_SMOKE_INITIAL_TITLE}`,
  'subtitle: Dev HTTP memo write smoke fixture',
  'date: 2026-05-03',
  'draft: false',
  'slug: preview-admin-memo',
  '---',
  '',
  'Initial memo body.',
  ''
].join('\n');

const createAdminAboutSmokeSource = () => [
  '---',
  '---',
  '',
  `## ${ADMIN_CONTENT_ABOUT_SMOKE_BODY_MARKER}`,
  '',
  'Initial about body.',
  '',
  ':::friend{name="Alice" url="https://alice.example/"}',
  'Engineer',
  ':::',
  '',
  ':::faq{question="About smoke?"}',
  'Yes.',
  ':::',
  ''
].join('\n');

const createTempAdminDevFixture = async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-admin-dev-'));
  const settingsDir = path.join(tempRoot, 'settings');
  const contentEntryPath = path.join(tempRoot, 'src', 'content', 'essay', `${ADMIN_CONTENT_SMOKE_ENTRY_ID}.md`);
  const bitsEntryPath = path.join(tempRoot, 'src', 'content', 'bits', `${ADMIN_CONTENT_BITS_SMOKE_ENTRY_ID}.md`);
  const memoEntryPath = path.join(tempRoot, 'src', 'content', 'memo', `${ADMIN_CONTENT_MEMO_SMOKE_ENTRY_ID}.md`);
  const aboutEntryPath = path.join(tempRoot, 'src', 'content', 'about', `${ADMIN_CONTENT_ABOUT_SMOKE_ENTRY_ID}.md`);
  await cp(defaultSettingsDir, settingsDir, { recursive: true });
  await mkdir(path.dirname(contentEntryPath), { recursive: true });
  await mkdir(path.dirname(bitsEntryPath), { recursive: true });
  await mkdir(path.dirname(memoEntryPath), { recursive: true });
  await mkdir(path.dirname(aboutEntryPath), { recursive: true });
  await writeFile(contentEntryPath, createAdminContentSmokeSource(), 'utf8');
  await writeFile(bitsEntryPath, createAdminBitsSmokeSource(), 'utf8');
  await writeFile(memoEntryPath, createAdminMemoSmokeSource(), 'utf8');
  await writeFile(aboutEntryPath, createAdminAboutSmokeSource(), 'utf8');

  return {
    tempRoot,
    settingsDir,
    contentEntryPath,
    bitsEntryPath,
    memoEntryPath,
    aboutEntryPath,
    cleanup: () => rm(tempRoot, { recursive: true, force: true })
  };
};

const hashSourceText = (sourceText) => createHash('sha1').update(sourceText).digest('hex');

const createJsonRequestInit = (baseUrl, payload) => ({
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    origin: baseUrl
  },
  body: JSON.stringify(payload)
});

const createAdminContentSmokeFrontmatter = (overrides = {}) => ({
  title: ADMIN_CONTENT_SMOKE_INITIAL_TITLE,
  description: 'Dev HTTP content write smoke fixture',
  date: '2026-05-01',
  tagsText: 'admin\nsmoke',
  draft: false,
  archive: true,
  slug: '',
  cover: '',
  badge: '',
  ...overrides
});

const createAdminContentSmokeWritePayload = (revision, options = {}) => ({
  collection: 'essay',
  entryId: ADMIN_CONTENT_SMOKE_ENTRY_ID,
  revision,
  frontmatter: createAdminContentSmokeFrontmatter(options.frontmatter),
  ...(typeof options.body === 'string' ? { body: options.body } : {})
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
    response.body.includes(ADMIN_CONTENT_LOCAL_DEV_NOTICE),
    `${label} is missing the Content Console local-dev notice`
  );
  if (expectNav) {
    assertHasAdminRouteNav(label, response.body);
  } else {
    assertNoAdminRouteNav(label, response.body);
  }
  expect(!response.body.includes('data-admin-content-root'), `${label} should stay readonly outside dev`);
};

const assertAdminContentEditStaticMissing = (label, response) => {
  expect(
    response.status === 404,
    `${label} should not be generated in the static preview build; got ${response.status}`
  );
};

const assertAdminContentOverviewDevShell = (label, response) => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(response.body.includes('Content Console'), `${label} is missing the Content Console route heading`);
  assertHasAdminRouteNav(label, response.body);
  expect(response.body.includes('内容管理'), `${label} is missing the content overview panel`);
  expect(response.body.includes('data-admin-content-root'), `${label} should emit the dev content console root`);
  expect(
    !response.body.includes(ADMIN_CONTENT_LOCAL_DEV_NOTICE),
    `${label} should show the dev content overview instead of the placeholder`
  );
};

const assertAdminContentEditDevShell = (label, response, collection = 'content') => {
  expect(response.status === 200, `${label} returned ${response.status}`);
  expect(
    response.contentType.toLowerCase().includes('text/html'),
    `${label} did not return HTML`
  );
  expect(
    response.body.includes('data-admin-header-visible="false"'),
    `${label} should use the compact ${collection} edit shell`
  );
  assertNoAdminRouteNav(label, response.body);
  expect(
    response.body.includes('data-admin-content-editor-island'),
    `${label} should emit the content Svelte editor island marker`
  );
  expect(
    !response.body.includes('id="admin-content-bootstrap"'),
    `${label} should not emit the legacy content editor bootstrap for ${collection}`
  );
  expect(
    !response.body.includes(ADMIN_CONTENT_LOCAL_DEV_NOTICE),
    `${label} should show the dev content collection instead of the placeholder`
  );
};

const getDevContentEntryPayload = async (baseUrl, collection, entryId, expectedRevision) => {
  const readResponse = await request(
    baseUrl,
    `/api/admin/content/entry/?collection=${collection}&entryId=${encodeURIComponent(entryId)}`
  );

  expect(
    readResponse.status === 200,
    `Dev GET /api/admin/content/entry/?collection=${collection} returned ${readResponse.status}`
  );
  expect(readResponse.json?.ok === true, `Dev Content GET for ${collection}/${entryId} did not return ok=true`);
  expect(
    readResponse.json?.payload?.collection === collection,
    `Dev Content GET returned the wrong collection for ${collection}/${entryId}`
  );
  expect(
    readResponse.json?.payload?.entryId === entryId,
    `Dev Content GET returned the wrong entryId for ${collection}/${entryId}`
  );
  expect(
    readResponse.json?.payload?.revision === expectedRevision,
    `Dev Content GET returned an unexpected revision for ${collection}/${entryId}`
  );
  expect(
    readResponse.json?.payload?.values && typeof readResponse.json.payload.values === 'object',
    `Dev Content GET returned missing editor values for ${collection}/${entryId}`
  );

  return readResponse.json.payload;
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

const runDevAdminContentWriteSmoke = async (baseUrl, fixture) => {
  const beforeDryRun = await readFile(fixture.contentEntryPath, 'utf8');
  const initialRevision = hashSourceText(beforeDryRun);
  const nextBody = [
    '# Admin Content HTTP Smoke',
    '',
    'Updated through the real dev HTTP content write smoke.',
    ''
  ].join('\n');
  const writePayload = createAdminContentSmokeWritePayload(initialRevision, {
    frontmatter: {
      title: ADMIN_CONTENT_SMOKE_UPDATED_TITLE
    },
    body: nextBody
  });

  const readResponse = await request(
    baseUrl,
    `/api/admin/content/entry/?collection=essay&entryId=${encodeURIComponent(ADMIN_CONTENT_SMOKE_ENTRY_ID)}`
  );

  expect(readResponse.status === 200, `Dev GET /api/admin/content/entry/?collection=essay returned ${readResponse.status}`);
  expect(readResponse.json?.ok === true, 'Dev Content GET did not return ok=true');
  expect(readResponse.json?.payload?.collection === 'essay', 'Dev Content GET returned the wrong collection');
  expect(readResponse.json?.payload?.entryId === ADMIN_CONTENT_SMOKE_ENTRY_ID, 'Dev Content GET returned the wrong entryId');
  expect(readResponse.json?.payload?.revision === initialRevision, 'Dev Content GET returned an unexpected revision');
  expect(
    readResponse.json?.payload?.values?.title === ADMIN_CONTENT_SMOKE_INITIAL_TITLE,
    'Dev Content GET returned an unexpected title'
  );

  const dryRunResponse = await request(
    baseUrl,
    '/api/admin/content/entry/?dryRun=1',
    createJsonRequestInit(baseUrl, writePayload)
  );

  expect(dryRunResponse.status === 200, `Dev POST /api/admin/content/entry/?dryRun=1 returned ${dryRunResponse.status}`);
  expect(dryRunResponse.json?.ok === true, 'Dev Content dry-run did not succeed');
  expect(dryRunResponse.json?.dryRun === true, 'Dev Content dry-run did not mark dryRun=true');
  expect(dryRunResponse.json?.result?.changed === true, 'Dev Content dry-run did not detect changes');
  expect(dryRunResponse.json?.result?.written === false, 'Dev Content dry-run should not write the source file');
  expect(
    Array.isArray(dryRunResponse.json?.result?.changedFields)
      && dryRunResponse.json.result.changedFields.includes('title')
      && dryRunResponse.json.result.changedFields.includes('body'),
    'Dev Content dry-run did not report the expected title/body changes'
  );

  const afterDryRun = await readFile(fixture.contentEntryPath, 'utf8');
  expect(afterDryRun === beforeDryRun, 'Dev Content dry-run unexpectedly mutated the source file');

  const saveResponse = await request(
    baseUrl,
    '/api/admin/content/entry/',
    createJsonRequestInit(baseUrl, writePayload)
  );

  expect(saveResponse.status === 200, `Dev POST /api/admin/content/entry/ returned ${saveResponse.status}`);
  expect(saveResponse.json?.ok === true, 'Dev Content write did not succeed');
  expect(saveResponse.json?.result?.changed === true, 'Dev Content write did not report changes');
  expect(saveResponse.json?.result?.written === true, 'Dev Content write did not mark written=true');
  expect(
    saveResponse.json?.payload?.values?.title === ADMIN_CONTENT_SMOKE_UPDATED_TITLE,
    'Dev Content write did not return the updated title'
  );
  expect(
    saveResponse.json?.payload?.bodyText === nextBody,
    'Dev Content write did not return the updated essay body'
  );

  const afterSave = await readFile(fixture.contentEntryPath, 'utf8');
  expect(afterSave !== beforeDryRun, 'Dev Content write did not update the source file');
  expect(afterSave.includes(`title: ${ADMIN_CONTENT_SMOKE_UPDATED_TITLE}`), 'Dev Content write persisted an unexpected title');
  expect(afterSave.endsWith(nextBody), 'Dev Content write persisted an unexpected essay body');
  expect(
    saveResponse.json?.payload?.revision === hashSourceText(afterSave)
      && saveResponse.json.payload.revision !== initialRevision,
    'Dev Content write did not return a fresh revision'
  );
};

const runDevAdminBitsContentWriteSmoke = async (baseUrl, fixture) => {
  const beforeSave = await readFile(fixture.bitsEntryPath, 'utf8');
  const initialRevision = hashSourceText(beforeSave);
  const payload = await getDevContentEntryPayload(
    baseUrl,
    'bits',
    ADMIN_CONTENT_BITS_SMOKE_ENTRY_ID,
    initialRevision
  );
  expect(
    payload.values.title === ADMIN_CONTENT_BITS_SMOKE_INITIAL_TITLE,
    'Dev Bits Content GET returned an unexpected title'
  );

  const nextBody = [
    'Updated bits body through the real dev HTTP content write smoke.',
    ''
  ].join('\n');
  const saveResponse = await request(
    baseUrl,
    '/api/admin/content/entry/',
    createJsonRequestInit(baseUrl, {
      collection: 'bits',
      entryId: ADMIN_CONTENT_BITS_SMOKE_ENTRY_ID,
      revision: payload.revision,
      frontmatter: payload.values,
      body: nextBody
    })
  );

  expect(saveResponse.status === 200, `Dev POST bits /api/admin/content/entry/ returned ${saveResponse.status}`);
  expect(saveResponse.json?.ok === true, 'Dev Bits Content write did not succeed');
  expect(saveResponse.json?.result?.changed === true, 'Dev Bits Content write did not report changes');
  expect(saveResponse.json?.result?.written === true, 'Dev Bits Content write did not mark written=true');
  expect(
    Array.isArray(saveResponse.json?.result?.changedFields)
      && saveResponse.json.result.changedFields.length === 1
      && saveResponse.json.result.changedFields[0] === 'body',
    'Dev Bits Content write should only report a body change'
  );
  expect(
    saveResponse.json?.payload?.bodyText === nextBody,
    'Dev Bits Content write did not return the updated body'
  );

  const afterSave = await readFile(fixture.bitsEntryPath, 'utf8');
  expect(afterSave !== beforeSave, 'Dev Bits Content write did not update the source file');
  expect(afterSave.endsWith(nextBody), 'Dev Bits Content write persisted an unexpected body');
  expect(
    saveResponse.json?.payload?.revision === hashSourceText(afterSave)
      && saveResponse.json.payload.revision !== initialRevision,
    'Dev Bits Content write did not return a fresh revision'
  );
};

const runDevAdminMemoContentWriteSmoke = async (baseUrl, fixture) => {
  const beforeSave = await readFile(fixture.memoEntryPath, 'utf8');
  const initialRevision = hashSourceText(beforeSave);
  const payload = await getDevContentEntryPayload(
    baseUrl,
    'memo',
    ADMIN_CONTENT_MEMO_SMOKE_ENTRY_ID,
    initialRevision
  );
  expect(
    payload.values.title === ADMIN_CONTENT_MEMO_SMOKE_INITIAL_TITLE,
    'Dev Memo Content GET returned an unexpected title'
  );

  const nextBody = [
    'Updated memo body through the real dev HTTP content write smoke.',
    ''
  ].join('\n');
  const saveResponse = await request(
    baseUrl,
    '/api/admin/content/entry/',
    createJsonRequestInit(baseUrl, {
      collection: 'memo',
      entryId: ADMIN_CONTENT_MEMO_SMOKE_ENTRY_ID,
      revision: payload.revision,
      frontmatter: payload.values,
      body: nextBody
    })
  );

  expect(saveResponse.status === 200, `Dev POST memo /api/admin/content/entry/ returned ${saveResponse.status}`);
  expect(saveResponse.json?.ok === true, 'Dev Memo Content write did not succeed');
  expect(saveResponse.json?.result?.changed === true, 'Dev Memo Content write did not report changes');
  expect(saveResponse.json?.result?.written === true, 'Dev Memo Content write did not mark written=true');
  expect(
    Array.isArray(saveResponse.json?.result?.changedFields)
      && saveResponse.json.result.changedFields.length === 1
      && saveResponse.json.result.changedFields[0] === 'body',
    'Dev Memo Content write should only report a body change'
  );
  expect(
    saveResponse.json?.payload?.bodyText === nextBody,
    'Dev Memo Content write did not return the updated body'
  );

  const afterSave = await readFile(fixture.memoEntryPath, 'utf8');
  expect(afterSave !== beforeSave, 'Dev Memo Content write did not update the source file');
  expect(afterSave.endsWith(nextBody), 'Dev Memo Content write persisted an unexpected body');
  expect(
    saveResponse.json?.payload?.revision === hashSourceText(afterSave)
      && saveResponse.json.payload.revision !== initialRevision,
    'Dev Memo Content write did not return a fresh revision'
  );
};

const runDevAdminAboutContentWriteSmoke = async (baseUrl, fixture) => {
  const beforeSave = await readFile(fixture.aboutEntryPath, 'utf8');
  const initialRevision = hashSourceText(beforeSave);
  const payload = await getDevContentEntryPayload(
    baseUrl,
    'about',
    ADMIN_CONTENT_ABOUT_SMOKE_ENTRY_ID,
    initialRevision
  );
  expect(
    payload.values && typeof payload.values === 'object' && Object.keys(payload.values).length === 0,
    'Dev About Content GET should return empty body-only values'
  );

  const nextBody = [
    '## Updated about body',
    '',
    'Updated about body through the real dev HTTP content write smoke.',
    '',
    ':::friend{name="Alice" url="https://alice.example/"}',
    'Updated engineer',
    ':::',
    '',
    ':::faq{question="About smoke updated?"}',
    'Yes, through Content Console.',
    ':::',
    ''
  ].join('\n');
  const saveResponse = await request(
    baseUrl,
    '/api/admin/content/entry/',
    createJsonRequestInit(baseUrl, {
      collection: 'about',
      entryId: ADMIN_CONTENT_ABOUT_SMOKE_ENTRY_ID,
      revision: payload.revision,
      body: nextBody
    })
  );

  expect(saveResponse.status === 200, `Dev POST about /api/admin/content/entry/ returned ${saveResponse.status}`);
  expect(saveResponse.json?.ok === true, 'Dev About Content write did not succeed');
  expect(saveResponse.json?.result?.changed === true, 'Dev About Content write did not report changes');
  expect(saveResponse.json?.result?.written === true, 'Dev About Content write did not mark written=true');
  expect(
    Array.isArray(saveResponse.json?.result?.changedFields)
      && saveResponse.json.result.changedFields.length === 1
      && saveResponse.json.result.changedFields[0] === 'body',
    'Dev About Content write should only report a body change'
  );
  expect(
    saveResponse.json?.payload?.bodyText === nextBody,
    'Dev About Content write did not return the updated body'
  );
  expect(
    saveResponse.json?.payload?.values
      && Object.keys(saveResponse.json.payload.values).length === 0,
    'Dev About Content write should return empty body-only values'
  );

  const afterSave = await readFile(fixture.aboutEntryPath, 'utf8');
  expect(afterSave !== beforeSave, 'Dev About Content write did not update the source file');
  expect(afterSave.includes(':::friend{name="Alice" url="https://alice.example/"}'), 'Dev About Content write did not persist friend directive');
  expect(afterSave.includes(':::faq{question="About smoke updated?"}'), 'Dev About Content write did not persist FAQ directive');
  expect(afterSave.startsWith('---\n---\n'), 'Dev About Content write should keep an empty about frontmatter block');
  expect(afterSave.endsWith(nextBody), 'Dev About Content write persisted an unexpected body');
  expect(
    saveResponse.json?.payload?.revision === hashSourceText(afterSave)
      && saveResponse.json.payload.revision !== initialRevision,
    'Dev About Content write did not return a fresh revision'
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
    const adminEssayContentEditResponse = await request(baseUrl, '/admin/content/essay/_edit/admin-console-guide/');
    const adminAboutContentEditResponse = await request(baseUrl, '/admin/content/about/_edit/index/');
    const adminImageResponse = await request(baseUrl, '/admin/images/');
    const adminChecksResponse = await request(baseUrl, '/admin/checks/');
    const adminDataResponse = await request(baseUrl, '/admin/data/');
    const getResponse = await request(baseUrl, '/api/admin/settings/');
    const exportResponse = await request(baseUrl, '/api/admin/data/settings/');
    const contentGetResponse = await request(baseUrl, '/api/admin/content/entry/');
    const contentCreateResponse = await request(baseUrl, '/api/admin/content/create/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: baseUrl
      },
      body: JSON.stringify({
        collection: 'essay',
        entryId: 'preview-boundary-create',
        frontmatter: createAdminContentSmokeFrontmatter()
      })
    });
    const contentExportResponse = await request(baseUrl, '/api/admin/content/export/?collection=essay&entryId=admin-console-guide');
    const previewGetResponse = await request(baseUrl, '/api/admin/preview/');
    const imageListResponse = await request(baseUrl, '/api/admin/images/list/');
    const imageMetaResponse = await request(baseUrl, '/api/admin/images/meta/');
    const imageUploadGetResponse = await request(baseUrl, '/api/admin/images/upload/');
    const imageUploadFormData = new FormData();
    imageUploadFormData.set('collection', 'essay');
    imageUploadFormData.set('entryId', 'preview-boundary-demo');
    imageUploadFormData.set(
      'image',
      new Blob(['preview boundary'], { type: 'image/png' }),
      'preview-boundary.png'
    );
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
    const contentDeleteResponse = await request(baseUrl, '/api/admin/content/delete/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: baseUrl
      },
      body: JSON.stringify({
        collection: 'essay',
        entryId: 'preview-boundary-demo',
        revision: 'invalid',
        expectedRelativePath: 'src/content/essay/preview-boundary-demo.md'
      })
    });
    const contentBulkStatusResponse = await request(baseUrl, '/api/admin/content/bulk-status/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: baseUrl
      },
      body: JSON.stringify({
        targetDraft: true,
        entries: [
          {
            collection: 'essay',
            entryId: 'preview-boundary-demo',
            expectedRelativePath: 'src/content/essay/preview-boundary-demo.md'
          }
        ]
      })
    });
    const contentBulkDeleteResponse = await request(baseUrl, '/api/admin/content/bulk-delete/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: baseUrl
      },
      body: JSON.stringify({
        entries: [
          {
            collection: 'essay',
            entryId: 'preview-boundary-demo',
            revision: 'invalid',
            expectedRelativePath: 'src/content/essay/preview-boundary-demo.md'
          }
        ]
      })
    });
    const contentBulkExportResponse = await request(baseUrl, '/api/admin/content/bulk-export/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: baseUrl
      },
      body: JSON.stringify({
        entries: [
          {
            collection: 'essay',
            entryId: 'preview-boundary-demo',
            expectedRelativePath: 'src/content/essay/preview-boundary-demo.md'
          }
        ]
      })
    });
    const previewPostResponse = await request(baseUrl, '/api/admin/preview/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: baseUrl
      },
      body: JSON.stringify({
        collection: 'essay',
        source: '# Preview'
      })
    });
    const imageUploadPostResponse = await request(baseUrl, '/api/admin/images/upload/', {
      method: 'POST',
      headers: {
        origin: baseUrl
      },
      body: imageUploadFormData
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
    assertAdminContentEditStaticMissing('Preview GET /admin/content/essay/_edit/admin-console-guide/', adminEssayContentEditResponse);
    assertAdminContentEditStaticMissing('Preview GET /admin/content/about/_edit/index/', adminAboutContentEditResponse);
    assertReadonlyAdminImageShell('Preview GET /admin/images/', adminImageResponse);
    assertReadonlyAdminChecksShell('Preview GET /admin/checks/', adminChecksResponse);
    assertReadonlyAdminDataShell('Preview GET /admin/data/', adminDataResponse);
    assertAdminSettingsStaticResponse('GET /api/admin/settings/', getResponse);
    assertAdminSettingsStaticResponse('GET /api/admin/data/settings/', exportResponse, '/api/admin/data/settings/');
    assertAdminContentStaticResponse('GET /api/admin/content/entry/', contentGetResponse);
    assertAdminContentStaticResponse('POST /api/admin/content/create/', contentCreateResponse, '/api/admin/content/create/');
    assertAdminContentStaticResponse('GET /api/admin/content/export/', contentExportResponse, '/api/admin/content/export/');
    assertAdminPreviewStaticResponse('GET /api/admin/preview/', previewGetResponse);
    assertAdminImageStaticResponse('GET /api/admin/images/list/', imageListResponse, '/api/admin/images/list/');
    assertAdminImageStaticResponse('GET /api/admin/images/meta/', imageMetaResponse, '/api/admin/images/meta/');
    assertAdminImageUploadStaticResponse('GET /api/admin/images/upload/', imageUploadGetResponse);
    assertAdminContentStaticResponse('POST /api/admin/content/entry/', contentPostResponse);
    assertAdminContentStaticResponse('POST /api/admin/content/delete/', contentDeleteResponse, '/api/admin/content/delete/');
    assertAdminContentStaticResponse('POST /api/admin/content/bulk-status/', contentBulkStatusResponse, '/api/admin/content/bulk-status/');
    assertAdminContentStaticResponse('POST /api/admin/content/bulk-delete/', contentBulkDeleteResponse, '/api/admin/content/bulk-delete/');
    assertAdminContentStaticResponse('POST /api/admin/content/bulk-export/', contentBulkExportResponse, '/api/admin/content/bulk-export/');
    assertAdminPreviewStaticResponse('POST /api/admin/preview/', previewPostResponse);
    assertAdminImageUploadStaticResponse('POST /api/admin/images/upload/', imageUploadPostResponse);
    assertAdminSettingsStaticResponse('POST /api/admin/settings/', postResponse);
    console.log('Preview admin boundary check passed.');
  } finally {
    await server.stop();
  }
};

export const runDevAdminSettingsSmokeCheck = async () => {
  const fixture = await createTempAdminDevFixture();
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
      ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT: fixture.tempRoot,
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
    const contentEssayEditResponse = await request(baseUrl, '/admin/content/essay/_edit/admin-console-guide/');
    const contentBitsEditResponse = await request(
      baseUrl,
      `/admin/content/bits/_edit/${ADMIN_CONTENT_BITS_SMOKE_ENTRY_ID}/`
    );
    const contentMemoEditResponse = await request(
      baseUrl,
      `/admin/content/memo/_edit/${ADMIN_CONTENT_MEMO_SMOKE_ENTRY_ID}/`
    );
    const contentAboutEditResponse = await request(
      baseUrl,
      `/admin/content/about/_edit/${ADMIN_CONTENT_ABOUT_SMOKE_ENTRY_ID}/`
    );
    assertAdminContentOverviewDevShell('Dev GET /admin/content/', contentOverviewResponse);
    assertAdminContentEditDevShell('Dev GET /admin/content/essay/_edit/admin-console-guide/', contentEssayEditResponse, 'essay');
    assertAdminContentEditDevShell(
      `Dev GET /admin/content/bits/_edit/${ADMIN_CONTENT_BITS_SMOKE_ENTRY_ID}/`,
      contentBitsEditResponse,
      'bits'
    );
    assertAdminContentEditDevShell(
      `Dev GET /admin/content/memo/_edit/${ADMIN_CONTENT_MEMO_SMOKE_ENTRY_ID}/`,
      contentMemoEditResponse,
      'memo'
    );
    assertAdminContentEditDevShell(
      `Dev GET /admin/content/about/_edit/${ADMIN_CONTENT_ABOUT_SMOKE_ENTRY_ID}/`,
      contentAboutEditResponse,
      'about'
    );
    expect(
      contentAboutEditResponse.body.includes('data-admin-about-editor-island'),
      'Dev About edit page should emit the about editor island marker'
    );
    await runDevAdminContentWriteSmoke(baseUrl, fixture);
    await runDevAdminBitsContentWriteSmoke(baseUrl, fixture);
    await runDevAdminMemoContentWriteSmoke(baseUrl, fixture);
    await runDevAdminAboutContentWriteSmoke(baseUrl, fixture);

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
