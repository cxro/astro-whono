import { describe, expect, it } from 'vitest';
import { loadAdminContentEditDevState } from '../src/components/admin/admin-content-edit-dev-state';
import type {
  AdminContentEditorOutlines,
  AdminContentEditorOutlineRegistration,
  AdminContentEditorStyleSlot
} from '../src/components/admin/admin-content-editor-registry';
import type {
  AdminAboutEditorPayload,
  AdminBitsEditorPayload,
  AdminEssayEditorPayload,
  AdminMemoEditorPayload
} from '../src/lib/admin-console/content-shared';

const essayPayload: AdminEssayEditorPayload = {
  collection: 'essay',
  entryId: 'essay-entry',
  publicEntryId: 'essay-entry',
  defaultPublicSlug: 'essay-entry',
  revision: 'essay-rev',
  relativePath: 'src/content/essay/essay-entry.md',
  writable: true,
  readonlyReason: null,
  bodyText: 'Essay body',
  values: {
    title: 'Essay title',
    description: '',
    date: '2026-06-01',
    publishedAt: '',
    updatedAt: '',
    tagsText: '',
    draft: false,
    archive: true,
    slug: '',
    cover: '',
    badge: ''
  }
};

const bitsPayload: AdminBitsEditorPayload = {
  collection: 'bits',
  entryId: 'bits-entry',
  publicEntryId: 'bits-entry',
  defaultPublicSlug: 'bits-entry',
  revision: 'bits-rev',
  relativePath: 'src/content/bits/bits-entry.md',
  writable: true,
  readonlyReason: null,
  bodyText: 'Bits body',
  values: {
    title: 'Bits title',
    description: '',
    date: '2026-06-01T10:00:00+08:00',
    tagsText: '',
    draft: false,
    authorName: '',
    authorAvatar: '',
    imagesText: ''
  }
};

const memoPayload: AdminMemoEditorPayload = {
  collection: 'memo',
  entryId: 'index',
  publicEntryId: 'index',
  defaultPublicSlug: 'index',
  revision: 'memo-rev',
  relativePath: 'src/content/memo/index.md',
  writable: true,
  readonlyReason: null,
  bodyText: 'Memo body',
  values: {
    title: 'Memo title',
    subtitle: '',
    date: '',
    draft: false,
    slug: ''
  }
};

const aboutPayload: AdminAboutEditorPayload = {
  collection: 'about',
  entryId: 'index',
  publicEntryId: 'index',
  defaultPublicSlug: 'index',
  revision: 'about-rev',
  relativePath: 'src/content/about/index.md',
  writable: true,
  readonlyReason: null,
  bodyText: 'About body',
  values: {}
};

const outlineFixture: AdminContentEditorOutlines = {
  essayOutlineItems: [
    {
      entryId: 'essay-entry',
      title: 'Essay title',
      editHref: '/admin/content/essay/_edit/essay-entry/',
      dateLabel: '2026-06-01',
      sourceError: null
    }
  ],
  bitsOutlineItems: [
    {
      entryId: 'bits-entry',
      title: 'Bits title',
      editHref: '/admin/content/bits/_edit/bits-entry/',
      dateLabel: '2026-06-01',
      sourceError: null
    }
  ]
};

describe('admin content edit dev state', () => {
  it('loads registry styles and outlines for writable editor payloads', async () => {
    const styleSlots: AdminContentEditorStyleSlot[] = [];
    const outlineRequests: Array<{
      collection: string;
      outlineKind: string;
      href: string;
    }> = [];

    const state = await loadAdminContentEditDevState({
      collection: 'bits',
      entryId: 'bits-entry',
      adminShellStylesHref: 'admin-shell.css',
      withBase: (path) => `/base${path}`,
      readPayload: async () => bitsPayload,
      loadStyleSlot: async (slot) => {
        styleSlots.push(slot);
        return `${slot}.css`;
      },
      loadOutlines: async (registration: AdminContentEditorOutlineRegistration, withBase) => {
        outlineRequests.push({
          collection: registration.collection,
          outlineKind: registration.outlineKind,
          href: withBase('/admin/content/bits/_edit/bits-entry/')
        });
        return outlineFixture;
      }
    });

    expect(state.payload).toBe(bitsPayload);
    expect(state.stylesHref).toEqual([
      'admin-shell.css',
      'adminContentEditor.css',
      'adminContentEditorBits.css',
      'adminContentEditorFrontmatter.css',
      'adminImageShared.css'
    ]);
    expect(state.outlines).toBe(outlineFixture);
    expect(styleSlots).toEqual([
      'adminContentEditor',
      'adminContentEditorBits',
      'adminContentEditorFrontmatter',
      'adminImageShared'
    ]);
    expect(outlineRequests).toEqual([
      {
        collection: 'bits',
        outlineKind: 'list',
        href: '/base/admin/content/bits/_edit/bits-entry/'
      }
    ]);
  });

  it.each([
    ['essay', essayPayload, [
      'article',
      'adminContentEditor',
      'adminContentEditorFrontmatter',
      'adminContentEditorImageInsert',
      'adminContentEditorGalleryInsert'
    ]],
    ['memo', memoPayload, [
      'article',
      'memo',
      'adminContentEditor',
      'adminContentEditorMemo',
      'adminContentEditorImageInsert'
    ]],
    ['about', aboutPayload, ['about', 'adminContentEditor', 'adminContentEditorAbout']]
  ] as const)('uses %s registry style slots', async (_collection, payload, expectedSlots) => {
    const styleSlots: AdminContentEditorStyleSlot[] = [];
    const state = await loadAdminContentEditDevState({
      collection: payload.collection,
      entryId: payload.entryId,
      adminShellStylesHref: 'admin-shell.css',
      withBase: (path) => path,
      readPayload: async () => payload,
      loadStyleSlot: async (slot) => {
        styleSlots.push(slot);
        return `${slot}.css`;
      },
      loadOutlines: async () => outlineFixture
    });

    expect(styleSlots).toEqual(expectedSlots);
    expect(state.stylesHref).toEqual([
      'admin-shell.css',
      ...expectedSlots.map((slot) => `${slot}.css`)
    ]);
  });
});
