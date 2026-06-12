export type AdminContentCollectionKey = 'essay' | 'bits' | 'memo' | 'about';

export type AdminContentFixedPageCapability = {
  entryId: 'index';
  sourcePath: string;
};

export type AdminContentCollectionCapability = {
  collection: AdminContentCollectionKey;
  label: string;
  consoleSectionHref: string;
  fixedPage: AdminContentFixedPageCapability | null;
  visible: boolean;
  // Entry API write contract; active editor UI exposure is still controlled by writable.
  entryWritable: boolean;
  writable: boolean;
  exportable: boolean;
  deletable: boolean;
  draftStatus: boolean;
  create: boolean;
  multiEntry: boolean;
  articleFilters: boolean;
  pagination: boolean;
  bodySearch: boolean;
  bodyImageUpload: boolean;
  imageUpload: boolean;
  imagePicker: boolean;
  readonlyReason: string | null;
  deleteUnsupportedReason: string | null;
};

export const ADMIN_CONTENT_COLLECTION_KEYS = ['essay', 'bits', 'memo', 'about'] as const satisfies readonly AdminContentCollectionKey[];

export const ADMIN_CONTENT_COLLECTION_CAPABILITIES = {
  essay: {
    collection: 'essay',
    label: '随笔',
    consoleSectionHref: '/essay/',
    fixedPage: null,
    visible: true,
    entryWritable: true,
    writable: true,
    exportable: true,
    deletable: true,
    draftStatus: true,
    create: true,
    multiEntry: true,
    articleFilters: true,
    pagination: true,
    bodySearch: true,
    bodyImageUpload: true,
    imageUpload: true,
    imagePicker: false,
    readonlyReason: null,
    deleteUnsupportedReason: null
  },
  bits: {
    collection: 'bits',
    label: '絮语',
    consoleSectionHref: '/bits/',
    fixedPage: null,
    visible: true,
    entryWritable: true,
    writable: true,
    exportable: true,
    deletable: true,
    draftStatus: true,
    create: true,
    multiEntry: true,
    articleFilters: true,
    pagination: true,
    bodySearch: true,
    bodyImageUpload: false,
    imageUpload: true,
    imagePicker: true,
    readonlyReason: null,
    deleteUnsupportedReason: null
  },
  memo: {
    collection: 'memo',
    label: '小记',
    consoleSectionHref: '/memo/',
    fixedPage: {
      entryId: 'index',
      sourcePath: 'src/content/memo/index.md'
    },
    visible: true,
    entryWritable: true,
    writable: true,
    exportable: true,
    deletable: false,
    draftStatus: false,
    create: false,
    multiEntry: false,
    articleFilters: false,
    pagination: false,
    bodySearch: true,
    bodyImageUpload: true,
    imageUpload: true,
    imagePicker: false,
    readonlyReason: null,
    deleteUnsupportedReason: 'memo 是固定单页内容，不支持从 Content Console 删除'
  },
  about: {
    collection: 'about',
    label: '关于',
    consoleSectionHref: '/about/',
    fixedPage: {
      entryId: 'index',
      sourcePath: 'src/content/about/index.md'
    },
    visible: true,
    entryWritable: true,
    writable: true,
    exportable: true,
    deletable: false,
    draftStatus: false,
    create: false,
    multiEntry: false,
    articleFilters: false,
    pagination: false,
    bodySearch: true,
    bodyImageUpload: false,
    imageUpload: false,
    imagePicker: false,
    readonlyReason: null,
    deleteUnsupportedReason: 'about 是固定单页内容，不支持从 Content Console 删除'
  }
} as const satisfies Record<AdminContentCollectionKey, AdminContentCollectionCapability>;

type CollectionKeysWithCapability<Capability extends keyof AdminContentCollectionCapability> = {
  [Collection in AdminContentCollectionKey]:
    (typeof ADMIN_CONTENT_COLLECTION_CAPABILITIES)[Collection][Capability] extends true
      ? Collection
      : never;
}[AdminContentCollectionKey];

export type AdminContentWriteCollectionKey = CollectionKeysWithCapability<'writable'>;
export type AdminContentEntryWriteCollectionKey = CollectionKeysWithCapability<'entryWritable'>;
export type AdminContentBodyImageUploadCollectionKey = CollectionKeysWithCapability<'bodyImageUpload'>;
export type AdminContentImageUploadCollectionKey = CollectionKeysWithCapability<'imageUpload'>;
export type AdminContentDeletableCollectionKey = CollectionKeysWithCapability<'deletable'>;
export type AdminContentExportableCollectionKey = CollectionKeysWithCapability<'exportable'>;
export type AdminContentDraftStatusCollectionKey = CollectionKeysWithCapability<'draftStatus'>;
export type AdminContentCreatableCollectionKey = CollectionKeysWithCapability<'create'>;

export const ADMIN_CONTENT_WRITE_COLLECTION_KEYS = ADMIN_CONTENT_COLLECTION_KEYS
  .filter((collection): collection is AdminContentWriteCollectionKey =>
    ADMIN_CONTENT_COLLECTION_CAPABILITIES[collection].writable);

export const ADMIN_CONTENT_ENTRY_WRITE_COLLECTION_KEYS = ADMIN_CONTENT_COLLECTION_KEYS
  .filter((collection): collection is AdminContentEntryWriteCollectionKey =>
    ADMIN_CONTENT_COLLECTION_CAPABILITIES[collection].entryWritable);

export const ADMIN_CONTENT_BODY_IMAGE_UPLOAD_COLLECTION_KEYS = ADMIN_CONTENT_COLLECTION_KEYS
  .filter((collection): collection is AdminContentBodyImageUploadCollectionKey =>
    ADMIN_CONTENT_COLLECTION_CAPABILITIES[collection].bodyImageUpload);

export const ADMIN_CONTENT_IMAGE_UPLOAD_COLLECTION_KEYS = ADMIN_CONTENT_COLLECTION_KEYS
  .filter((collection): collection is AdminContentImageUploadCollectionKey =>
    ADMIN_CONTENT_COLLECTION_CAPABILITIES[collection].imageUpload);

export const ADMIN_CONTENT_DELETABLE_COLLECTION_KEYS = ADMIN_CONTENT_COLLECTION_KEYS
  .filter((collection): collection is AdminContentDeletableCollectionKey =>
    ADMIN_CONTENT_COLLECTION_CAPABILITIES[collection].deletable);

export const ADMIN_CONTENT_EXPORTABLE_COLLECTION_KEYS = ADMIN_CONTENT_COLLECTION_KEYS
  .filter((collection): collection is AdminContentExportableCollectionKey =>
    ADMIN_CONTENT_COLLECTION_CAPABILITIES[collection].exportable);

export const ADMIN_CONTENT_DRAFT_STATUS_COLLECTION_KEYS = ADMIN_CONTENT_COLLECTION_KEYS
  .filter((collection): collection is AdminContentDraftStatusCollectionKey =>
    ADMIN_CONTENT_COLLECTION_CAPABILITIES[collection].draftStatus);

export const ADMIN_CONTENT_CREATABLE_COLLECTION_KEYS = ADMIN_CONTENT_COLLECTION_KEYS
  .filter((collection): collection is AdminContentCreatableCollectionKey =>
    ADMIN_CONTENT_COLLECTION_CAPABILITIES[collection].create);

export const getAdminContentCollectionCapability = (
  collection: AdminContentCollectionKey
): AdminContentCollectionCapability =>
  ADMIN_CONTENT_COLLECTION_CAPABILITIES[collection];

export const getAdminContentFixedPageCapability = (
  collection: AdminContentCollectionKey
): AdminContentFixedPageCapability | null =>
  getAdminContentCollectionCapability(collection).fixedPage;

export const isAdminContentCollectionKey = (value: string): value is AdminContentCollectionKey =>
  (ADMIN_CONTENT_COLLECTION_KEYS as readonly string[]).includes(value);

export const isAdminContentWriteCollectionKey = (value: string): value is AdminContentWriteCollectionKey =>
  isAdminContentCollectionKey(value) && getAdminContentCollectionCapability(value).writable;

export const isAdminContentEntryWriteCollectionKey = (value: string): value is AdminContentEntryWriteCollectionKey =>
  isAdminContentCollectionKey(value) && getAdminContentCollectionCapability(value).entryWritable;

export const isAdminContentBodyImageUploadCollectionKey = (value: string): value is AdminContentBodyImageUploadCollectionKey =>
  isAdminContentCollectionKey(value) && getAdminContentCollectionCapability(value).bodyImageUpload;

export const isAdminContentImageUploadCollectionKey = (value: string): value is AdminContentImageUploadCollectionKey =>
  isAdminContentCollectionKey(value) && getAdminContentCollectionCapability(value).imageUpload;

export const isAdminContentDeletableCollectionKey = (value: string): value is AdminContentDeletableCollectionKey =>
  isAdminContentCollectionKey(value) && getAdminContentCollectionCapability(value).deletable;

export const isAdminContentExportableCollectionKey = (value: string): value is AdminContentExportableCollectionKey =>
  isAdminContentCollectionKey(value) && getAdminContentCollectionCapability(value).exportable;

export const isAdminContentDraftStatusCollectionKey = (value: string): value is AdminContentDraftStatusCollectionKey =>
  isAdminContentCollectionKey(value) && getAdminContentCollectionCapability(value).draftStatus;

export const isAdminContentCreatableCollectionKey = (value: string): value is AdminContentCreatableCollectionKey =>
  isAdminContentCollectionKey(value) && getAdminContentCollectionCapability(value).create;
