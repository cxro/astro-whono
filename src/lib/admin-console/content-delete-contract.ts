export const ADMIN_CONTENT_DELETABLE_COLLECTION_KEYS = ['essay', 'bits'] as const;

export type AdminContentDeletableCollectionKey = typeof ADMIN_CONTENT_DELETABLE_COLLECTION_KEYS[number];

export const isAdminContentDeletableCollectionKey = (value: string): value is AdminContentDeletableCollectionKey =>
  (ADMIN_CONTENT_DELETABLE_COLLECTION_KEYS as readonly string[]).includes(value);
