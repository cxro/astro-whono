import { describe, expect, it } from 'vitest';
import { saveContentEntry } from '../src/components/admin/editor/content-editor-client';
import type { AdminBitsEditorValues } from '../src/lib/admin-console/content-shared';

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

describe('content editor client', () => {
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
});
