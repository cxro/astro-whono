import type {
  AdminBitsEditorValues,
  AdminContentEditorValues,
  AdminContentWriteCollectionKey,
  AdminEssayEditorValues
} from '../../../lib/admin-console/content-shared';
import { getWriteFieldLabel } from './editor-shell-helpers';

type ContentEditorCapabilities = {
  body: boolean;
  preview: boolean;
  bodyImageInsert: boolean;
  bodyImageUpload: boolean;
  bodyGalleryInsert: boolean;
  imageUpload: boolean;
  imagePicker: boolean;
  imageArray: boolean;
  essayOutline: boolean;
};

export type ContentEditorAdapter = {
  collection: AdminContentWriteCollectionKey;
  dialogTitle: string;
  fieldsAriaLabel: string;
  capabilities: ContentEditorCapabilities;
  frontmatterIssuePaths: ReadonlySet<string>;
  isFrontmatterIssuePath: (path: string) => boolean;
  cloneValues: (value: AdminContentEditorValues) => AdminContentEditorValues;
  isEqualValues: (left: AdminContentEditorValues | null, right: AdminContentEditorValues | null) => boolean;
  getWriteFieldLabel: (field: string) => string;
  getDeleteTitle: (value: AdminContentEditorValues, entryId: string) => string;
};

const cloneEssayValues = (value: AdminEssayEditorValues): AdminEssayEditorValues => ({
  title: value.title,
  description: value.description,
  date: value.date,
  publishedAt: value.publishedAt,
  tagsText: value.tagsText,
  draft: value.draft,
  archive: value.archive,
  slug: value.slug,
  cover: value.cover,
  badge: value.badge
});

const cloneBitsValues = (value: AdminBitsEditorValues): AdminBitsEditorValues => ({
  title: value.title,
  description: value.description,
  date: value.date,
  tagsText: value.tagsText,
  draft: value.draft,
  authorName: value.authorName,
  authorAvatar: value.authorAvatar,
  imagesText: value.imagesText
});

export const isEssayEditorValues = (value: AdminContentEditorValues | null): value is AdminEssayEditorValues =>
  Boolean(value && 'publishedAt' in value && 'archive' in value && 'cover' in value && 'badge' in value);

export const isBitsEditorValues = (value: AdminContentEditorValues | null): value is AdminBitsEditorValues =>
  Boolean(value && 'authorName' in value && 'authorAvatar' in value && 'imagesText' in value);

const cloneContentEditorValues = (value: AdminContentEditorValues): AdminContentEditorValues => {
  if (isEssayEditorValues(value)) return cloneEssayValues(value);
  if (isBitsEditorValues(value)) return cloneBitsValues(value);
  return { ...value };
};

const isEqualContentEditorValues = (
  left: AdminContentEditorValues | null,
  right: AdminContentEditorValues | null
): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const getContentWriteFieldLabel = (
  field: string,
  labels: Readonly<Record<string, string>>
): string =>
  labels[field] ?? getWriteFieldLabel(field);

const hasExactFrontmatterIssuePath = (paths: ReadonlySet<string>, path: string): boolean =>
  paths.has(path);

const ESSAY_FRONTMATTER_ISSUE_PATHS = new Set([
  'title',
  'date',
  'publishedAt',
  'description',
  'tags',
  'slug',
  'badge',
  'cover'
]);

const BITS_FRONTMATTER_ISSUE_PATHS = new Set([
  'title',
  'date',
  'description',
  'tags',
  'draft',
  'authorName',
  'authorAvatar',
  'imagesText'
]);

const isBitsFrontmatterIssuePath = (path: string): boolean =>
  BITS_FRONTMATTER_ISSUE_PATHS.has(path) || path.startsWith('images[');

const ESSAY_FIELD_LABELS: Readonly<Record<string, string>> = {
  title: '标题',
  description: '摘要',
  date: '日期',
  publishedAt: '发布时间',
  tags: '标签',
  draft: '草稿状态',
  archive: '归档状态',
  slug: '链接别名',
  cover: '封面图',
  badge: '徽标',
  body: '正文'
};

const BITS_FIELD_LABELS: Readonly<Record<string, string>> = {
  title: '标题',
  description: '摘要',
  date: '时间',
  tags: '标签',
  draft: '草稿状态',
  authorName: '作者名称',
  authorAvatar: '作者头像',
  author: '作者',
  images: '图片',
  imagesText: '图片',
  body: '正文'
};

const ESSAY_ADAPTER: ContentEditorAdapter = {
  collection: 'essay',
  dialogTitle: '文章信息',
  fieldsAriaLabel: '随笔字段',
  capabilities: {
    body: true,
    preview: true,
    bodyImageInsert: true,
    bodyImageUpload: true,
    bodyGalleryInsert: true,
    imageUpload: false,
    imagePicker: false,
    imageArray: false,
    essayOutline: true
  },
  frontmatterIssuePaths: ESSAY_FRONTMATTER_ISSUE_PATHS,
  isFrontmatterIssuePath: (path) => hasExactFrontmatterIssuePath(ESSAY_FRONTMATTER_ISSUE_PATHS, path),
  cloneValues: cloneContentEditorValues,
  isEqualValues: isEqualContentEditorValues,
  getWriteFieldLabel: (field) => getContentWriteFieldLabel(field, ESSAY_FIELD_LABELS),
  getDeleteTitle: (value, entryId) => isEssayEditorValues(value) ? value.title || entryId : entryId
};

const BITS_ADAPTER: ContentEditorAdapter = {
  collection: 'bits',
  dialogTitle: '修改信息',
  fieldsAriaLabel: '内容字段',
  capabilities: {
    body: true,
    preview: true,
    bodyImageInsert: false,
    bodyImageUpload: false,
    bodyGalleryInsert: false,
    imageUpload: true,
    imagePicker: true,
    imageArray: true,
    essayOutline: false
  },
  frontmatterIssuePaths: BITS_FRONTMATTER_ISSUE_PATHS,
  isFrontmatterIssuePath: isBitsFrontmatterIssuePath,
  cloneValues: cloneContentEditorValues,
  isEqualValues: isEqualContentEditorValues,
  getWriteFieldLabel: (field) => getContentWriteFieldLabel(field, BITS_FIELD_LABELS),
  getDeleteTitle: (value, entryId) => isBitsEditorValues(value) ? value.title || entryId : entryId
};

const CONTENT_EDITOR_ADAPTERS = {
  essay: ESSAY_ADAPTER,
  bits: BITS_ADAPTER
} as const satisfies Record<AdminContentWriteCollectionKey, ContentEditorAdapter>;

export const getContentEditorAdapter = (collection: AdminContentWriteCollectionKey): ContentEditorAdapter =>
  CONTENT_EDITOR_ADAPTERS[collection];
