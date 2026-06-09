import { describe, expect, it } from 'vitest';
import {
  createContentEntry,
  renderContentPreview,
  saveContentEntry
} from '../src/components/admin/editor/content-editor-client';
import type { AdminBitsEditorValues, AdminEssayEditorValues } from '../src/lib/admin-console/content-shared';

const bitsValues: AdminBitsEditorValues = {
  title: 'Bit',
  description: '',
  date: '2026-05-26T10:00:00+08:00',
  tagsText: '',
  draft: false,
  authorName: '',
  authorAvatar: '',
  imagesText: ''
};

const essayValues: AdminEssayEditorValues = {
  title: 'New Essay',
  description: '',
  date: '2026-06-08',
  publishedAt: '',
  updatedAt: '',
  tagsText: '',
  draft: true,
  archive: true,
  slug: '',
  cover: '',
  badge: ''
};

describe('content editor client', () => {
  it('sends create payloads without revision', async () => {
    const requested = {
      body: null as unknown
    };
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requested.body = JSON.parse(String(init?.body ?? '{}')) as unknown;
      return new Response(JSON.stringify({
        ok: true,
        result: {
          changed: true,
          written: true,
          changedFields: ['entry'],
          relativePath: 'src/content/essay/new-essay.md',
          editHref: '/admin/content/essay/_edit/new-essay/'
        },
        editHref: '/admin/content/essay/_edit/new-essay/',
        payload: {
          collection: 'essay',
          entryId: 'new-essay',
          publicEntryId: 'new-essay',
          defaultPublicSlug: 'new-essay',
          revision: 'rev',
          relativePath: 'src/content/essay/new-essay.md',
          writable: true,
          readonlyReason: null,
          bodyText: '\n',
          values: essayValues
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    const outcome = await createContentEntry({
      endpoint: '/api/admin/content/create/',
      collection: 'essay',
      entryId: 'new-essay',
      frontmatter: essayValues,
      fetchImpl
    });

    expect(requested.body).toEqual({
      collection: 'essay',
      entryId: 'new-essay',
      frontmatter: essayValues
    });
    expect(outcome.editHref).toBe('/admin/content/essay/_edit/new-essay/');
    expect(outcome.payload?.collection).toBe('essay');
  });

  it('sends body-only payloads for about saves', async () => {
    const requested = {
      body: null as unknown
    };
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requested.body = JSON.parse(String(init?.body ?? '{}')) as unknown;
      return new Response(JSON.stringify({
        ok: true,
        result: {
          changed: true,
          written: true,
          changedFields: ['body'],
          relativePath: 'src/content/about/index.md'
        },
        payload: {
          collection: 'about',
          entryId: 'index',
          publicEntryId: 'index',
          defaultPublicSlug: 'index',
          revision: 'next-rev',
          relativePath: 'src/content/about/index.md',
          writable: true,
          readonlyReason: null,
          bodyText: 'About body',
          values: {}
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    await saveContentEntry({
      endpoint: '/api/admin/content/entry/',
      collection: 'about',
      entryId: 'index',
      revision: 'rev',
      body: 'About body',
      fetchImpl
    });

    expect(requested.body).toEqual({
      collection: 'about',
      entryId: 'index',
      revision: 'rev',
      body: 'About body'
    });
  });

  it('sends body-only payloads for memo saves', async () => {
    const requested = {
      body: null as unknown
    };
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requested.body = JSON.parse(String(init?.body ?? '{}')) as unknown;
      return new Response(JSON.stringify({
        ok: true,
        result: {
          changed: true,
          written: true,
          changedFields: ['body'],
          relativePath: 'src/content/memo/index.md'
        },
        payload: {
          collection: 'memo',
          entryId: 'index',
          publicEntryId: 'index',
          defaultPublicSlug: 'index',
          revision: 'next-rev',
          relativePath: 'src/content/memo/index.md',
          writable: true,
          readonlyReason: null,
          bodyText: 'Memo body',
          values: {
            title: 'Memo',
            subtitle: '',
            date: '',
            draft: false,
            slug: ''
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    await saveContentEntry({
      endpoint: '/api/admin/content/entry/',
      collection: 'memo',
      entryId: 'index',
      revision: 'rev',
      body: 'Memo body',
      fetchImpl
    });

    expect(requested.body).toEqual({
      collection: 'memo',
      entryId: 'index',
      revision: 'rev',
      body: 'Memo body'
    });
  });

  it('keeps dry-run as a URL flag instead of changing the save payload', async () => {
    const requested = {
      url: '',
      body: null as unknown
    };
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requested.url = String(input);
      requested.body = JSON.parse(String(init?.body ?? '{}')) as unknown;
      return new Response(JSON.stringify({
        ok: true,
        result: {
          changed: false,
          written: false,
          changedFields: [],
          relativePath: 'src/content/bits/demo.md'
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    await saveContentEntry({
      endpoint: '/api/admin/content/entry/',
      collection: 'bits',
      entryId: 'demo',
      revision: 'rev',
      frontmatter: bitsValues,
      dryRun: true,
      fetchImpl
    });

    expect(requested.url).toBe('http://127.0.0.1/api/admin/content/entry/?dryRun=1');
    expect(requested.body).toEqual({
      collection: 'bits',
      entryId: 'demo',
      revision: 'rev',
      frontmatter: bitsValues
    });
  });

  it('keeps latest bits payload details when a stale save is rejected', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({
      ok: false,
      errors: ['检测到内容文件已在外部更新'],
      payload: {
        collection: 'bits',
        entryId: 'demo',
        publicEntryId: 'demo',
        defaultPublicSlug: 'demo',
        revision: 'latest-revision',
        relativePath: 'src/content/bits/demo.md',
        writable: true,
        readonlyReason: null,
        bodyText: '\nexternal body\n',
        values: {
          ...bitsValues,
          title: 'External title'
        }
      }
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' }
    })) as typeof fetch;

    const outcome = await saveContentEntry({
      endpoint: '/api/admin/content/entry/',
      collection: 'bits',
      entryId: 'demo',
      revision: 'stale-revision',
      frontmatter: bitsValues,
      body: 'local body',
      fetchImpl
    });

    expect(outcome.responseOk).toBe(false);
    expect(outcome.payloadOk).toBe(false);
    expect(outcome.revision).toBe('latest-revision');
    expect(outcome.latestBody).toBe('\nexternal body\n');
    expect(outcome.latestValues).toEqual({
      ...bitsValues,
      title: 'External title'
    });
  });

  it('preserves preview warnings from successful preview payloads', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({
      ok: true,
      result: {
        html: '<p>Preview</p>',
        warnings: ['图片路径可能无法解析'],
        elapsedMs: 3,
        codeHighlight: 'shiki-rehype'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })) as typeof fetch;

    const outcome = await renderContentPreview({
      endpoint: '/api/admin/preview/',
      collection: 'bits',
      entryId: 'demo',
      source: 'body',
      fetchImpl
    });

    expect(outcome.responseOk).toBe(true);
    expect(outcome.payloadOk).toBe(true);
    expect(outcome.result?.warnings).toEqual(['图片路径可能无法解析']);
  });
});
