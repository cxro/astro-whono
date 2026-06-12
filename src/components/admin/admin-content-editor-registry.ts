import type { AdminContentWriteCollectionKey } from '../../lib/admin-console/content-collections';
import { getAdminContentCollectionCapability } from '../../lib/admin-console/content-collections';
import { getAdminContentEntryEditHref } from '../../lib/admin-console/content-routes';
import type { AdminAboutEditorPayload } from '../../lib/admin-console/content-about-contract';
import {
  type AdminBitsEditorPayload,
  type AdminContentWorkspaceEditorPayload,
  type AdminEssayEditorPayload,
  type AdminMemoEditorPayload
} from '../../lib/admin-console/content-editor-payload';
import type { BitsCardAuthorInput } from '../../lib/bits-card-view-model';
import {
  loadAdminContentSourceIndex,
  loadAdminContentSourceManifest
} from '../../lib/admin-console/content-source-index';
import type { BitsEditorIslandProps } from './editor/bits-editor-island-props';
import type { EssayEditorShellProps } from './editor/editor-shell-props';
import type {
  EditorOutlineEssaySourceItem,
  EditorOutlineListSourceItem
} from './editor/editor-outline-helpers';
import type { MemoEditorIslandProps } from './editor/memo-editor-island-props';
import type { AboutEditorIslandProps } from './editor/about-editor-island-props';

type WithBase = (path: string) => string;

export type AdminContentEditorEndpoints = {
  endpoint: string;
  exportEndpoint: string;
  deleteEndpoint: string;
  previewEndpoint: string;
  imageUploadEndpoint: string;
};

export type AdminContentEditorStyleSlot =
  | 'adminContentEditor'
  | 'adminContentEditorAbout'
  | 'adminContentEditorBits'
  | 'adminContentEditorFrontmatter'
  | 'adminContentEditorGalleryInsert'
  | 'adminContentEditorImageInsert'
  | 'adminContentEditorMemo'
  | 'adminImageShared'
  | 'about'
  | 'article'
  | 'memo';

export type AdminContentEditorOutlineKind = 'none' | 'essay' | 'list';

export type AdminContentEditorInfoTrigger = {
  attribute: 'data-admin-article-info-trigger' | 'data-admin-bits-info-trigger';
  label: string;
  panelId: string;
};

export type AdminContentEditorIslandKey = 'essay' | 'bits' | 'memo' | 'about';

export type AdminContentEditorOutlines = {
  essayOutlineItems: EditorOutlineEssaySourceItem[];
  bitsOutlineItems: EditorOutlineListSourceItem[];
};

export type AdminContentEditorIslandProps =
  | EssayEditorShellProps
  | BitsEditorIslandProps
  | MemoEditorIslandProps
  | AboutEditorIslandProps;

type BuildBaseIslandPropsInput<Payload extends AdminContentWorkspaceEditorPayload> = {
  payload: Payload;
  endpoints: AdminContentEditorEndpoints;
  returnHref: string;
};

type BuildEssayIslandPropsInput = BuildBaseIslandPropsInput<AdminEssayEditorPayload> & {
  essayOutlineItems: EditorOutlineEssaySourceItem[];
  initialArticleInfoOpen: boolean;
};

type BuildBitsIslandPropsInput = BuildBaseIslandPropsInput<AdminBitsEditorPayload> & {
  defaultAuthor: BitsCardAuthorInput;
  bitsOutlineItems: EditorOutlineListSourceItem[];
};

type BuildMemoIslandPropsInput = BuildBaseIslandPropsInput<AdminMemoEditorPayload>;
type BuildAboutIslandPropsInput = BuildBaseIslandPropsInput<AdminAboutEditorPayload>;

type BuildIslandPropsInput<Payload extends AdminContentWorkspaceEditorPayload> =
  Payload extends AdminEssayEditorPayload
    ? BuildEssayIslandPropsInput
    : Payload extends AdminBitsEditorPayload
      ? BuildBitsIslandPropsInput
      : Payload extends AdminAboutEditorPayload
        ? BuildAboutIslandPropsInput
        : BuildMemoIslandPropsInput;

export type AdminContentEditorPageRegistration<
  Collection extends AdminContentWriteCollectionKey = AdminContentWriteCollectionKey,
  Payload extends AdminContentWorkspaceEditorPayload = AdminContentWorkspaceEditorPayload
> = {
  collection: Collection;
  workspaceClassName: string;
  articleClassName: string;
  island: AdminContentEditorIslandKey;
  styleSlots: readonly AdminContentEditorStyleSlot[];
  outlineKind: AdminContentEditorOutlineKind;
  infoTrigger: AdminContentEditorInfoTrigger | null;
  usesImagePicker: boolean;
  resolveReturnHref: (input: {
    withBase: WithBase;
    collectionHref: string;
  }) => string;
  buildIslandProps: (input: BuildIslandPropsInput<Payload>) => AdminContentEditorIslandProps;
};

export type AdminContentEditorOutlineRegistration = {
  collection: AdminContentWriteCollectionKey;
  outlineKind: AdminContentEditorOutlineKind;
};

const loadArticleStylesHref = async (): Promise<string> => {
  const { default: articleStylesHref } = await import('../../styles/article.css?url');
  return articleStylesHref;
};

const loadAboutStylesHref = async (): Promise<string> => {
  const { default: aboutStylesHref } = await import('../../styles/about.css?url');
  return aboutStylesHref;
};

const loadMemoStylesHref = async (): Promise<string> => {
  const { default: memoStylesHref } = await import('../../styles/memo.css?url');
  return memoStylesHref;
};

const loadAdminImageSharedStylesHref = async (): Promise<string> => {
  const { default: adminImageSharedStylesHref } = await import('../../styles/components/admin/images/shared.css?url');
  return adminImageSharedStylesHref;
};

const STYLE_SLOT_LOADERS = {
  adminContentEditor: async () =>
    (await import('../../styles/components/admin/content/edit-core.css?url')).default,
  adminContentEditorAbout: async () =>
    (await import('../../styles/components/admin/content/edit-about.css?url')).default,
  adminContentEditorBits: async () =>
    (await import('../../styles/components/admin/content/edit-bits.css?url')).default,
  adminContentEditorFrontmatter: async () =>
    (await import('../../styles/components/admin/content/edit-frontmatter.css?url')).default,
  adminContentEditorGalleryInsert: async () =>
    (await import('../../styles/components/admin/content/edit-gallery-insert.css?url')).default,
  adminContentEditorImageInsert: async () =>
    (await import('../../styles/components/admin/content/edit-image-insert.css?url')).default,
  adminContentEditorMemo: async () =>
    (await import('../../styles/components/admin/content/edit-memo.css?url')).default,
  adminImageShared: loadAdminImageSharedStylesHref,
  about: loadAboutStylesHref,
  article: loadArticleStylesHref,
  memo: loadMemoStylesHref
} as const satisfies Record<AdminContentEditorStyleSlot, () => Promise<string>>;

export const ADMIN_CONTENT_EDITOR_BASE_STYLE_SLOTS = ['adminContentEditor'] as const satisfies readonly AdminContentEditorStyleSlot[];

export const loadAdminContentEditorStyleSlot = async (
  slot: AdminContentEditorStyleSlot
): Promise<string> =>
  STYLE_SLOT_LOADERS[slot]();

export const loadAdminContentEditorStyleHrefs = async (
  slots: readonly AdminContentEditorStyleSlot[],
  loadStyleSlot: (slot: AdminContentEditorStyleSlot) => Promise<string> = loadAdminContentEditorStyleSlot
): Promise<string[]> =>
  Promise.all(slots.map((slot) => loadStyleSlot(slot)));

export const loadAdminContentEditorBaseStyleHrefs = async (
  loadStyleSlot?: (slot: AdminContentEditorStyleSlot) => Promise<string>
): Promise<string[]> =>
  loadAdminContentEditorStyleHrefs(ADMIN_CONTENT_EDITOR_BASE_STYLE_SLOTS, loadStyleSlot);

const loadEssayOutlineItems = async (withBase: WithBase): Promise<EditorOutlineEssaySourceItem[]> => {
  const manifest = await loadAdminContentSourceManifest();
  return (await loadAdminContentSourceIndex(manifest, 'essay'))
    .map((item) => ({
      entryId: item.id,
      title: item.title,
      editHref: withBase(getAdminContentEntryEditHref('essay', item.id)),
      dateLabel: item.dateLabel,
      sourceError: item.sourceError
    }));
};

const loadBitsOutlineItems = async (withBase: WithBase): Promise<EditorOutlineListSourceItem[]> => {
  const manifest = await loadAdminContentSourceManifest();
  return (await loadAdminContentSourceIndex(manifest, 'bits'))
    .map((item) => ({
      entryId: item.id,
      title: item.title,
      editHref: withBase(getAdminContentEntryEditHref('bits', item.id)),
      dateLabel: item.dateLabel,
      sourceError: item.sourceError
    }));
};

export const createEmptyAdminContentEditorOutlines = (): AdminContentEditorOutlines => ({
  essayOutlineItems: [],
  bitsOutlineItems: []
});

export const loadAdminContentEditorOutlines = async (
  registration: AdminContentEditorOutlineRegistration,
  withBase: WithBase
): Promise<AdminContentEditorOutlines> => {
  if (registration.outlineKind === 'essay') {
    return {
      essayOutlineItems: await loadEssayOutlineItems(withBase),
      bitsOutlineItems: []
    };
  }

  if (registration.outlineKind === 'list') {
    return {
      essayOutlineItems: [],
      bitsOutlineItems: await loadBitsOutlineItems(withBase)
    };
  }

  return createEmptyAdminContentEditorOutlines();
};

const buildEssayEditorIslandProps = ({
  payload,
  endpoints,
  returnHref,
  essayOutlineItems,
  initialArticleInfoOpen
}: BuildEssayIslandPropsInput): EssayEditorShellProps => ({
  ...endpoints,
  returnHref,
  entryId: payload.entryId,
  relativePath: payload.relativePath,
  defaultPublicSlug: payload.defaultPublicSlug,
  revision: payload.revision,
  initialFrontmatter: payload.values,
  initialBody: payload.bodyText,
  essayOutlineItems,
  initialArticleInfoOpen
});

const buildBitsEditorIslandProps = ({
  payload,
  endpoints,
  returnHref,
  defaultAuthor,
  bitsOutlineItems
}: BuildBitsIslandPropsInput): BitsEditorIslandProps => ({
  ...endpoints,
  returnHref,
  entryId: payload.entryId,
  relativePath: payload.relativePath,
  defaultPublicSlug: payload.defaultPublicSlug,
  revision: payload.revision,
  initialFrontmatter: payload.values,
  initialBody: payload.bodyText,
  defaultAuthor,
  bitsOutlineItems
});

const buildMemoEditorIslandProps = ({
  payload,
  endpoints,
  returnHref
}: BuildMemoIslandPropsInput): MemoEditorIslandProps => ({
  endpoint: endpoints.endpoint,
  exportEndpoint: endpoints.exportEndpoint,
  previewEndpoint: endpoints.previewEndpoint,
  imageUploadEndpoint: endpoints.imageUploadEndpoint,
  returnHref,
  entryId: payload.entryId,
  revision: payload.revision,
  initialFrontmatter: payload.values,
  initialBody: payload.bodyText
});

const buildAboutEditorIslandProps = ({
  payload,
  endpoints,
  returnHref
}: BuildAboutIslandPropsInput): AboutEditorIslandProps => ({
  endpoint: endpoints.endpoint,
  exportEndpoint: endpoints.exportEndpoint,
  previewEndpoint: endpoints.previewEndpoint,
  returnHref,
  entryId: payload.entryId,
  revision: payload.revision,
  initialBody: payload.bodyText
});

const CONTENT_EDITOR_PAGE_REGISTRY = {
  essay: {
    collection: 'essay',
    workspaceClassName: 'admin-content-edit-page--essay',
    articleClassName: 'admin-content-editor--svelte',
    island: 'essay',
    styleSlots: [
      'article',
      'adminContentEditor',
      'adminContentEditorFrontmatter',
      'adminContentEditorImageInsert',
      'adminContentEditorGalleryInsert'
    ],
    outlineKind: 'essay',
    infoTrigger: {
      attribute: 'data-admin-article-info-trigger',
      label: '修改信息',
      panelId: 'admin-editor-frontmatter-panel'
    },
    usesImagePicker: getAdminContentCollectionCapability('essay').imagePicker,
    resolveReturnHref: ({ withBase }) => withBase('/admin/content/'),
    buildIslandProps: buildEssayEditorIslandProps
  },
  bits: {
    collection: 'bits',
    workspaceClassName: 'admin-content-edit-page--bits',
    articleClassName: 'admin-content-editor--bits',
    island: 'bits',
    styleSlots: [
      'adminContentEditor',
      'adminContentEditorBits',
      'adminContentEditorFrontmatter',
      'adminImageShared'
    ],
    outlineKind: 'list',
    infoTrigger: {
      attribute: 'data-admin-bits-info-trigger',
      label: '修改信息',
      panelId: 'admin-editor-frontmatter-panel'
    },
    usesImagePicker: getAdminContentCollectionCapability('bits').imagePicker,
    resolveReturnHref: ({ collectionHref }) => collectionHref,
    buildIslandProps: buildBitsEditorIslandProps
  },
  memo: {
    collection: 'memo',
    workspaceClassName: 'admin-content-edit-page--memo',
    articleClassName: 'admin-content-editor--memo',
    island: 'memo',
    styleSlots: [
      'article',
      'memo',
      'adminContentEditor',
      'adminContentEditorMemo',
      'adminContentEditorImageInsert'
    ],
    outlineKind: 'none',
    infoTrigger: null,
    usesImagePicker: getAdminContentCollectionCapability('memo').imagePicker,
    resolveReturnHref: ({ collectionHref }) => collectionHref,
    buildIslandProps: buildMemoEditorIslandProps
  },
  about: {
    collection: 'about',
    workspaceClassName: 'admin-content-edit-page--about',
    articleClassName: 'admin-content-editor--about',
    island: 'about',
    styleSlots: ['about', 'adminContentEditor', 'adminContentEditorAbout'],
    outlineKind: 'none',
    infoTrigger: null,
    usesImagePicker: getAdminContentCollectionCapability('about').imagePicker,
    resolveReturnHref: ({ collectionHref }) => collectionHref,
    buildIslandProps: buildAboutEditorIslandProps
  }
} as const satisfies {
  [Collection in AdminContentWriteCollectionKey]: AdminContentEditorPageRegistration<
    Collection,
    Extract<AdminContentWorkspaceEditorPayload, { collection: Collection }>
  >;
};

export const getAdminContentEditorPageRegistration = <Collection extends AdminContentWriteCollectionKey>(
  collection: Collection
): (typeof CONTENT_EDITOR_PAGE_REGISTRY)[Collection] =>
  CONTENT_EDITOR_PAGE_REGISTRY[collection];

export const getAdminContentEditorStyleSlots = (
  collection: AdminContentWriteCollectionKey
): readonly AdminContentEditorStyleSlot[] =>
  getAdminContentEditorPageRegistration(collection).styleSlots;

export const buildAdminContentEditorIslandProps = ({
  payload,
  endpoints,
  returnHref,
  defaultAuthor,
  outlines,
  initialArticleInfoOpen
}: {
  payload: AdminContentWorkspaceEditorPayload;
  endpoints: AdminContentEditorEndpoints;
  returnHref: string;
  defaultAuthor: BitsCardAuthorInput;
  outlines: AdminContentEditorOutlines;
  initialArticleInfoOpen: boolean;
}): AdminContentEditorIslandProps => {
  if (payload.collection === 'essay') {
    return CONTENT_EDITOR_PAGE_REGISTRY.essay.buildIslandProps({
      payload,
      endpoints,
      returnHref,
      essayOutlineItems: outlines.essayOutlineItems,
      initialArticleInfoOpen
    });
  }

  if (payload.collection === 'bits') {
    return CONTENT_EDITOR_PAGE_REGISTRY.bits.buildIslandProps({
      payload,
      endpoints,
      returnHref,
      defaultAuthor,
      bitsOutlineItems: outlines.bitsOutlineItems
    });
  }

  if (payload.collection === 'about') {
    return CONTENT_EDITOR_PAGE_REGISTRY.about.buildIslandProps({
      payload,
      endpoints,
      returnHref
    });
  }

  return CONTENT_EDITOR_PAGE_REGISTRY.memo.buildIslandProps({
    payload,
    endpoints,
    returnHref
  });
};
