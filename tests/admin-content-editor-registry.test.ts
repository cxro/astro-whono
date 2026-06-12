import { describe, expect, it } from 'vitest';
import {
  buildAdminContentEditorIslandProps,
  createEmptyAdminContentEditorOutlines,
  getAdminContentEditorPageRegistration,
  getAdminContentEditorStyleSlots,
  loadAdminContentEditorBaseStyleHrefs,
  loadAdminContentEditorStyleHrefs,
  type AdminContentEditorEndpoints,
  type AdminContentEditorStyleSlot
} from '../src/components/admin/admin-content-editor-registry';
import { ADMIN_CONTENT_EDITOR_ISLAND_KEYS } from '../src/components/admin/admin-content-editor-islands';
import type {
  AdminAboutEditorPayload,
  AdminBitsEditorPayload,
  AdminEssayEditorPayload,
  AdminMemoEditorPayload
} from '../src/lib/admin-console/content-shared';
import {
  getAdminContentCollectionCapability,
  type AdminContentWriteCollectionKey
} from '../src/lib/admin-console/content-collections';

const endpoints: AdminContentEditorEndpoints = {
  endpoint: '/api/admin/content/entry/',
  exportEndpoint: '/api/admin/content/export/',
  deleteEndpoint: '/api/admin/content/delete/',
  previewEndpoint: '/api/admin/preview/',
  imageUploadEndpoint: '/api/admin/images/upload/'
};

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
    description: 'Essay description',
    date: '2026-06-01',
    publishedAt: '',
    updatedAt: '',
    tagsText: 'tag',
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

describe('admin content editor page registry', () => {
  it('declares page-level affordances for essay, bits, memo, and about', () => {
    const essay = getAdminContentEditorPageRegistration('essay');
    const bits = getAdminContentEditorPageRegistration('bits');
    const memo = getAdminContentEditorPageRegistration('memo');
    const about = getAdminContentEditorPageRegistration('about');

    expect(essay.island).toBe('essay');
    expect(essay.styleSlots).toEqual([
      'article',
      'adminContentEditor',
      'adminContentEditorFrontmatter',
      'adminContentEditorImageInsert',
      'adminContentEditorGalleryInsert'
    ]);
    expect(essay.outlineKind).toBe('essay');
    expect(essay.resolveReturnHref({
      withBase: (path) => `/base${path}`,
      collectionHref: '/base/admin/content/?collection=essay'
    })).toBe('/base/admin/content/');
    expect(essay.infoTrigger).toEqual({
      attribute: 'data-admin-article-info-trigger',
      label: '修改信息',
      panelId: 'admin-editor-frontmatter-panel'
    });
    expect(essay.usesImagePicker).toBe(false);

    expect(bits.island).toBe('bits');
    expect(bits.styleSlots).toEqual([
      'adminContentEditor',
      'adminContentEditorBits',
      'adminContentEditorFrontmatter',
      'adminImageShared'
    ]);
    expect(bits.outlineKind).toBe('list');
    expect(bits.resolveReturnHref({
      withBase: (path) => `/base${path}`,
      collectionHref: '/base/admin/content/?collection=bits'
    })).toBe('/base/admin/content/?collection=bits');
    expect(bits.infoTrigger?.attribute).toBe('data-admin-bits-info-trigger');
    expect(bits.usesImagePicker).toBe(true);

    expect(memo.island).toBe('memo');
    expect(memo.styleSlots).toEqual([
      'article',
      'memo',
      'adminContentEditor',
      'adminContentEditorMemo',
      'adminContentEditorImageInsert'
    ]);
    expect(memo.outlineKind).toBe('none');
    expect(memo.infoTrigger).toBeNull();
    expect(memo.usesImagePicker).toBe(false);

    expect(about.island).toBe('about');
    expect(about.styleSlots).toEqual(['about', 'adminContentEditor', 'adminContentEditorAbout']);
    expect(about.outlineKind).toBe('none');
    expect(about.resolveReturnHref({
      withBase: (path) => `/base${path}`,
      collectionHref: '/base/admin/content/?collection=about'
    })).toBe('/base/admin/content/?collection=about');
    expect(about.infoTrigger).toBeNull();
    expect(about.usesImagePicker).toBe(false);
  });

  it('derives image picker affordance from collection capabilities', () => {
    const collections: AdminContentWriteCollectionKey[] = ['essay', 'bits', 'memo', 'about'];

    for (const collection of collections) {
      expect(getAdminContentEditorPageRegistration(collection).usesImagePicker)
        .toBe(getAdminContentCollectionCapability(collection).imagePicker);
    }
  });

  it('keeps style slot loading ordered and injectable', async () => {
    const requested: AdminContentEditorStyleSlot[] = [];
    const loadStyleSlot = async (slot: AdminContentEditorStyleSlot) => {
      requested.push(slot);
      return `${slot}.css`;
    };

    await expect(loadAdminContentEditorBaseStyleHrefs(loadStyleSlot)).resolves.toEqual(['adminContentEditor.css']);
    await expect(loadAdminContentEditorStyleHrefs(getAdminContentEditorStyleSlots('memo'), loadStyleSlot))
      .resolves.toEqual([
        'article.css',
        'memo.css',
        'adminContentEditor.css',
        'adminContentEditorMemo.css',
        'adminContentEditorImageInsert.css'
      ]);
    await expect(loadAdminContentEditorStyleHrefs(getAdminContentEditorStyleSlots('about'), loadStyleSlot))
      .resolves.toEqual(['about.css', 'adminContentEditor.css', 'adminContentEditorAbout.css']);
    expect(requested).toEqual([
      'adminContentEditor',
      'article',
      'memo',
      'adminContentEditor',
      'adminContentEditorMemo',
      'adminContentEditorImageInsert',
      'about',
      'adminContentEditor',
      'adminContentEditorAbout'
    ]);
  });

  it('keeps registered editor islands within the supported island loader keys', () => {
    expect(ADMIN_CONTENT_EDITOR_ISLAND_KEYS).toEqual(['essay', 'bits', 'memo', 'about']);
    expect(ADMIN_CONTENT_EDITOR_ISLAND_KEYS).toContain(getAdminContentEditorPageRegistration('essay').island);
    expect(ADMIN_CONTENT_EDITOR_ISLAND_KEYS).toContain(getAdminContentEditorPageRegistration('bits').island);
    expect(ADMIN_CONTENT_EDITOR_ISLAND_KEYS).toContain(getAdminContentEditorPageRegistration('memo').island);
    expect(ADMIN_CONTENT_EDITOR_ISLAND_KEYS).toContain(getAdminContentEditorPageRegistration('about').island);
  });

  it('builds island props without mixing collection-specific fields', () => {
    const outlines = {
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

    const essayProps = buildAdminContentEditorIslandProps({
      payload: essayPayload,
      endpoints,
      returnHref: '/admin/content/',
      defaultAuthor: { name: 'Default', avatar: '/avatar.png' },
      outlines,
      initialArticleInfoOpen: true
    });
    expect(essayProps).toMatchObject({
      entryId: 'essay-entry',
      returnHref: '/admin/content/',
      initialFrontmatter: essayPayload.values,
      initialBody: 'Essay body',
      essayOutlineItems: outlines.essayOutlineItems,
      initialArticleInfoOpen: true
    });
    expect('defaultAuthor' in essayProps).toBe(false);

    const bitsProps = buildAdminContentEditorIslandProps({
      payload: bitsPayload,
      endpoints,
      returnHref: '/admin/content/?collection=bits',
      defaultAuthor: { name: 'Default', avatar: '/avatar.png' },
      outlines,
      initialArticleInfoOpen: false
    });
    expect(bitsProps).toMatchObject({
      entryId: 'bits-entry',
      returnHref: '/admin/content/?collection=bits',
      initialFrontmatter: bitsPayload.values,
      initialBody: 'Bits body',
      defaultAuthor: { name: 'Default', avatar: '/avatar.png' },
      bitsOutlineItems: outlines.bitsOutlineItems
    });
    expect('initialArticleInfoOpen' in bitsProps).toBe(false);

    const memoProps = buildAdminContentEditorIslandProps({
      payload: memoPayload,
      endpoints,
      returnHref: '/admin/content/?collection=memo',
      defaultAuthor: { name: 'Default', avatar: '/avatar.png' },
      outlines: createEmptyAdminContentEditorOutlines(),
      initialArticleInfoOpen: true
    });
    expect(memoProps).toEqual({
      endpoint: endpoints.endpoint,
      exportEndpoint: endpoints.exportEndpoint,
      previewEndpoint: endpoints.previewEndpoint,
      imageUploadEndpoint: endpoints.imageUploadEndpoint,
      returnHref: '/admin/content/?collection=memo',
      entryId: 'index',
      revision: 'memo-rev',
      initialFrontmatter: memoPayload.values,
      initialBody: 'Memo body'
    });

    const aboutProps = buildAdminContentEditorIslandProps({
      payload: aboutPayload,
      endpoints,
      returnHref: '/admin/content/?collection=about',
      defaultAuthor: { name: 'Default', avatar: '/avatar.png' },
      outlines: createEmptyAdminContentEditorOutlines(),
      initialArticleInfoOpen: true
    });
    expect(aboutProps).toEqual({
      endpoint: endpoints.endpoint,
      exportEndpoint: endpoints.exportEndpoint,
      previewEndpoint: endpoints.previewEndpoint,
      returnHref: '/admin/content/?collection=about',
      entryId: 'index',
      revision: 'about-rev',
      initialBody: 'About body'
    });
    expect('imageUploadEndpoint' in aboutProps).toBe(false);
  });
});
