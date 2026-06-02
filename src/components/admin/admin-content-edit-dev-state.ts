import type {
  AdminContentCollectionKey
} from '../../lib/admin-console/content';
import { getAdminContentEntryEditHref } from '../../lib/admin-console/content-routes';
import {
  type AdminBitsEditorPayload,
  readAdminContentEntryEditorPayload,
  type AdminContentEditorPayload,
  type AdminEssayEditorPayload
} from '../../lib/admin-console/content-shared';
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

type WithBase = (path: string) => string;

type LoadAdminContentEditDevStateInput = {
  collection: AdminContentCollectionKey;
  entryId: string;
  adminShellStylesHref: string;
  withBase: WithBase;
};

export type AdminContentEditDevState = {
  payload: AdminContentEditorPayload;
  essayOutlineItems: EditorOutlineEssaySourceItem[];
  bitsOutlineItems: EditorOutlineListSourceItem[];
  stylesHref: string[];
};

export type AdminContentEditorEndpoints = {
  endpoint: string;
  exportEndpoint: string;
  deleteEndpoint: string;
  previewEndpoint: string;
  imageUploadEndpoint: string;
};

const loadAdminContentStylesHref = async (): Promise<string> => {
  const { default: adminContentStylesHref } = await import('../../styles/components/admin/content/index.css?url');
  return adminContentStylesHref;
};

const loadArticleStylesHref = async (): Promise<string> => {
  const { default: articleStylesHref } = await import('../../styles/article.css?url');
  return articleStylesHref;
};

const loadAdminImageSharedStylesHref = async (): Promise<string> => {
  const { default: adminImageSharedStylesHref } = await import('../../styles/components/admin/images/shared.css?url');
  return adminImageSharedStylesHref;
};

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

export const loadAdminContentEditDevState = async ({
  collection,
  entryId,
  adminShellStylesHref,
  withBase
}: LoadAdminContentEditDevStateInput): Promise<AdminContentEditDevState> => {
  const payload = await readAdminContentEntryEditorPayload(collection, entryId);
  const adminContentStylesHref = await loadAdminContentStylesHref();

  if (!payload.writable) {
    return {
      payload,
      essayOutlineItems: [],
      bitsOutlineItems: [],
      stylesHref: [adminShellStylesHref, adminContentStylesHref]
    };
  }

  if (payload.collection === 'essay') {
    const [articleStylesHref, essayOutlineItems] = await Promise.all([
      loadArticleStylesHref(),
      loadEssayOutlineItems(withBase)
    ]);

    return {
      payload,
      essayOutlineItems,
      bitsOutlineItems: [],
      stylesHref: [adminShellStylesHref, articleStylesHref, adminContentStylesHref]
    };
  }

  if (payload.collection === 'bits') {
    const [adminImageSharedStylesHref, bitsOutlineItems] = await Promise.all([
      loadAdminImageSharedStylesHref(),
      loadBitsOutlineItems(withBase)
    ]);

    return {
      payload,
      essayOutlineItems: [],
      bitsOutlineItems,
      stylesHref: [adminShellStylesHref, adminContentStylesHref, adminImageSharedStylesHref]
    };
  }

  return {
    payload,
    essayOutlineItems: [],
    bitsOutlineItems: [],
    stylesHref: [adminShellStylesHref, adminContentStylesHref]
  };
};

export const buildEssayEditorIslandProps = ({
  payload,
  endpoints,
  returnHref,
  essayOutlineItems,
  initialArticleInfoOpen
}: {
  payload: AdminEssayEditorPayload;
  endpoints: AdminContentEditorEndpoints;
  returnHref: string;
  essayOutlineItems: EditorOutlineEssaySourceItem[];
  initialArticleInfoOpen: boolean;
}): EssayEditorShellProps => ({
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

export const buildBitsEditorIslandProps = ({
  payload,
  endpoints,
  returnHref,
  defaultAuthor,
  bitsOutlineItems
}: {
  payload: AdminBitsEditorPayload;
  endpoints: AdminContentEditorEndpoints;
  returnHref: string;
  defaultAuthor: BitsCardAuthorInput;
  bitsOutlineItems: EditorOutlineListSourceItem[];
}): BitsEditorIslandProps => ({
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
