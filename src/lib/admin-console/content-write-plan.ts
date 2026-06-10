import { normalizeBitsAvatarPath } from '../../utils/format';
import {
  parseEssayDateInput,
  parseEssayPublishedAtInput
} from '../../utils/date-only';
import { normalizeAdminBitsImageSource } from './image-shared';
import {
  patchMarkdownFrontmatter,
  replaceMarkdownBody,
  type FrontmatterPatch
} from './frontmatter';
import { findMissingMarkdownBodyLocalImageReferences } from './essay-image-references';
import { buildAdminAboutWritePlan } from './content-about-contract';
import {
  buildEssayFrontmatterFromValues,
  parseAdminEssayEditorInput,
  parseTagsText,
  validateEssayPublicSlug,
  type AdminEssayOptionalInputMode
} from './content-essay-frontmatter';
import type { AdminContentValidationIssue } from './content-entry-contract';
import {
  getAdminContentCollectionCapability,
  type AdminContentEntryWriteCollectionKey
} from './content-collections';
import {
  AdminContentEntryResolutionError,
  getAdminContentReadOnlyReason,
  loadAdminContentSourceState,
  type AdminContentSourceState
} from './content-entry-source';
import type {
  AdminBitsEditorValues,
  AdminEssayEditorValues
} from './content-editor-payload';
import {
  createAdminContentValidationIssue as createIssue,
  hasOwn,
  isRecord,
  normalizeOptionalText
} from './content-entry-utils';

export type AdminBitsImage = {
  src: string;
  width?: number;
  height?: number;
  alt?: string;
};

export type AdminBitsFrontmatter = {
  title?: string;
  description?: string;
  date: string;
  tags: string[];
  draft: boolean;
  author?: {
    name?: string;
    avatar?: string;
  };
  images?: AdminBitsImage[];
};

type AdminWritePlan = {
  issues: AdminContentValidationIssue[];
  changedFields: string[];
  patches: FrontmatterPatch[];
  bodyText?: string;
};

type FrontmatterDiffField = {
  field: string;
  path: readonly string[];
  currentValue: unknown;
  nextValue: unknown;
};

const getRequiredStringField = (
  input: Record<string, unknown>,
  field: string,
  issues: AdminContentValidationIssue[]
): string => {
  const value = input[field];
  if (typeof value === 'string') return value;
  issues.push(createIssue(field, `frontmatter.${field} 必须是字符串`));
  return '';
};

const getRequiredBooleanField = (
  input: Record<string, unknown>,
  field: string,
  issues: AdminContentValidationIssue[]
): boolean => {
  const value = input[field];
  if (typeof value === 'boolean') return value;
  issues.push(createIssue(field, `frontmatter.${field} 必须是布尔值`));
  return false;
};

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

const parseOptionalPositiveInteger = (value: unknown): number | undefined => {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return Number.NaN;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return POSITIVE_INTEGER_PATTERN.test(trimmed) ? Number(trimmed) : Number.NaN;
};

const isPositiveInteger = (value: number | undefined): boolean =>
  value === undefined || (Number.isInteger(value) && value > 0);

const parseAdminBitsEditorInput = (
  input: unknown
): { values?: AdminBitsEditorValues; issues: AdminContentValidationIssue[] } => {
  if (!isRecord(input)) {
    return {
      issues: [createIssue('frontmatter', 'frontmatter 必须是对象')]
    };
  }

  const issues: AdminContentValidationIssue[] = [];
  const values: AdminBitsEditorValues = {
    title: getRequiredStringField(input, 'title', issues),
    description: getRequiredStringField(input, 'description', issues),
    date: getRequiredStringField(input, 'date', issues),
    tagsText: getRequiredStringField(input, 'tagsText', issues),
    draft: getRequiredBooleanField(input, 'draft', issues),
    authorName: getRequiredStringField(input, 'authorName', issues),
    authorAvatar: getRequiredStringField(input, 'authorAvatar', issues),
    imagesText: getRequiredStringField(input, 'imagesText', issues)
  };

  return issues.length > 0 ? { issues } : { values, issues };
};

const parseBitsImages = (value: string): { images?: AdminBitsImage[]; issues: AdminContentValidationIssue[] } => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { issues: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      issues: [createIssue('imagesText', 'images 必须是合法 JSON 数组')]
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      issues: [createIssue('imagesText', 'images 必须是 JSON 数组')]
    };
  }

  const issues: AdminContentValidationIssue[] = [];
  const images: AdminBitsImage[] = [];

  parsed.forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push(createIssue(`images[${index}]`, `images[${index}] 必须是对象`));
      return;
    }

    const src = normalizeOptionalText(item.src);
    const normalizedSrc = normalizeAdminBitsImageSource(src);
    if (!normalizedSrc) {
      issues.push(createIssue(`images[${index}].src`, `images[${index}].src 只允许 https:// 远程路径或仓库内相对图片路径`));
    }

    const width = parseOptionalPositiveInteger(item.width);
    const height = parseOptionalPositiveInteger(item.height);
    const hasInvalidWidth = !isPositiveInteger(width);
    const hasInvalidHeight = !isPositiveInteger(height);

    if (hasInvalidWidth) {
      issues.push(createIssue(`images[${index}].width`, `images[${index}].width 必须是正整数`));
    }
    if (hasInvalidHeight) {
      issues.push(createIssue(`images[${index}].height`, `images[${index}].height 必须是正整数`));
    }

    if (
      !normalizedSrc ||
      hasInvalidWidth ||
      hasInvalidHeight
    ) {
      return;
    }

    const alt = normalizeOptionalText(item.alt);
    images.push({
      src: normalizedSrc,
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(alt ? { alt } : {})
    });
  });

  return issues.length > 0 ? { issues } : { issues, images };
};

export const buildBitsFrontmatterFromValues = (
  values: AdminBitsEditorValues
): { frontmatter?: AdminBitsFrontmatter; issues: AdminContentValidationIssue[] } => {
  const issues: AdminContentValidationIssue[] = [];
  const date = values.date.trim();

  if (!date) {
    issues.push(createIssue('date', 'bits.date 不能为空'));
  } else if (Number.isNaN(new Date(date).valueOf())) {
    issues.push(createIssue('date', 'bits.date 不是合法日期时间'));
  }

  const authorName = values.authorName.trim();
  const authorAvatarRaw = values.authorAvatar.trim();
  const authorAvatar = authorAvatarRaw ? normalizeBitsAvatarPath(authorAvatarRaw) : '';
  if (authorAvatarRaw && authorAvatar === undefined) {
    issues.push(
      createIssue(
        'authorAvatar',
        'author.avatar 只允许相对图片路径（例如 author/avatar.webp），不要带 public/、不要以 / 开头，也不要使用 URL、..、?、#'
      )
    );
  }

  const imageResult = parseBitsImages(values.imagesText);
  issues.push(...imageResult.issues);

  if (issues.length > 0) {
    return { issues };
  }

  return {
    issues,
    frontmatter: {
      ...(values.title.trim() ? { title: values.title.trim() } : {}),
      ...(values.description.trim() ? { description: values.description.trim() } : {}),
      date,
      tags: parseTagsText(values.tagsText),
      draft: values.draft === true,
      ...((authorName || authorAvatar)
        ? {
            author: {
              ...(authorName ? { name: authorName } : {}),
              ...(authorAvatar ? { avatar: authorAvatar } : {})
            }
          }
        : {}),
      ...(imageResult.images && imageResult.images.length > 0 ? { images: imageResult.images } : {})
    }
  };
};

const getCurrentTextValue = (
  frontmatter: Record<string, unknown>,
  field: string,
  fallback: unknown
): unknown => {
  if (!hasOwn(frontmatter, field)) return fallback;
  const value = frontmatter[field];
  return typeof value === 'string' ? value.trim() : value;
};

const getCurrentOptionalTextValue = (
  frontmatter: Record<string, unknown>,
  field: string
): unknown => {
  const value = getCurrentTextValue(frontmatter, field, undefined);
  return typeof value === 'string' && value.length === 0 ? undefined : value;
};

const getCurrentBooleanValue = (
  frontmatter: Record<string, unknown>,
  field: string,
  fallback: boolean
): unknown => {
  if (!hasOwn(frontmatter, field)) return fallback;
  const value = frontmatter[field];
  return typeof value === 'boolean' ? value : value;
};

const getCurrentStringArrayValue = (
  frontmatter: Record<string, unknown>,
  field: string,
  fallback: string[]
): unknown => {
  if (!hasOwn(frontmatter, field)) return fallback;
  const value = frontmatter[field];
  if (!Array.isArray(value)) return value;
  return value.every((item) => typeof item === 'string')
    ? value.map((item) => item.trim()).filter(Boolean)
    : value;
};

type AdminEssayCurrentFrontmatter = {
  title: unknown;
  description: unknown;
  date: unknown;
  publishedAt: unknown;
  preservedPublishedAt?: string;
  updatedAt: unknown;
  preservedUpdatedAt?: string;
  tags: unknown;
  draft: unknown;
  archive: unknown;
  slug: unknown;
  cover: unknown;
  badge: unknown;
};

type AdminBitsCurrentFrontmatter = {
  title: unknown;
  description: unknown;
  date: unknown;
  tags: unknown;
  draft: unknown;
  author: unknown;
  images: unknown;
};

const buildEssayCurrentFrontmatter = (state: AdminContentSourceState): AdminEssayCurrentFrontmatter => {
  const frontmatter = state.rawFrontmatter;
  const currentDate = getCurrentTextValue(frontmatter, 'date', '');
  const dateResult = typeof currentDate === 'string' ? parseEssayDateInput(currentDate) : null;
  const currentPublishedAt = getCurrentOptionalTextValue(frontmatter, 'publishedAt');
  const preservedPublishedAt = typeof currentPublishedAt === 'string'
    ? (parseEssayPublishedAtInput(currentPublishedAt) ? currentPublishedAt : undefined)
    : dateResult?.publishedAtText;
  const currentUpdatedAt = getCurrentOptionalTextValue(frontmatter, 'updatedAt');
  const currentUpdatedAtResult = parseEssayDateInput(currentUpdatedAt);

  return {
    title: getCurrentTextValue(frontmatter, 'title', ''),
    description: getCurrentOptionalTextValue(frontmatter, 'description'),
    date: currentDate,
    publishedAt: currentPublishedAt,
    ...(preservedPublishedAt ? { preservedPublishedAt } : {}),
    updatedAt: currentUpdatedAtResult?.dateText ?? currentUpdatedAt,
    ...(currentUpdatedAtResult ? { preservedUpdatedAt: currentUpdatedAtResult.dateText } : {}),
    tags: getCurrentStringArrayValue(frontmatter, 'tags', []),
    draft: getCurrentBooleanValue(frontmatter, 'draft', false),
    archive: getCurrentBooleanValue(frontmatter, 'archive', true),
    slug: getCurrentOptionalTextValue(frontmatter, 'slug'),
    cover: getCurrentOptionalTextValue(frontmatter, 'cover'),
    badge: getCurrentOptionalTextValue(frontmatter, 'badge')
  };
};

const getCurrentBitsAuthorValue = (frontmatter: Record<string, unknown>): unknown => {
  if (!hasOwn(frontmatter, 'author')) return undefined;

  const author = frontmatter.author;
  if (!isRecord(author)) return author;

  const name = getCurrentOptionalTextValue(author, 'name');
  const rawAvatar = getCurrentOptionalTextValue(author, 'avatar');
  if ((name !== undefined && typeof name !== 'string') || (rawAvatar !== undefined && typeof rawAvatar !== 'string')) {
    return author;
  }

  const avatar = rawAvatar ? normalizeBitsAvatarPath(rawAvatar) : '';
  if (rawAvatar && avatar === undefined) return author;

  return name || avatar
    ? {
        ...(name ? { name } : {}),
        ...(avatar ? { avatar } : {})
      }
    : undefined;
};

const getCurrentBitsImagesValue = (frontmatter: Record<string, unknown>): unknown => {
  if (!hasOwn(frontmatter, 'images')) return undefined;

  const images = frontmatter.images;
  if (!Array.isArray(images)) return images;

  const parsed = parseBitsImages(JSON.stringify(images));
  if (parsed.issues.length > 0) return images;
  return parsed.images && parsed.images.length > 0 ? parsed.images : undefined;
};

const buildBitsCurrentFrontmatter = (state: AdminContentSourceState): AdminBitsCurrentFrontmatter => {
  const frontmatter = state.rawFrontmatter;
  return {
    title: getCurrentOptionalTextValue(frontmatter, 'title'),
    description: getCurrentOptionalTextValue(frontmatter, 'description'),
    date: getCurrentTextValue(frontmatter, 'date', ''),
    tags: getCurrentStringArrayValue(frontmatter, 'tags', []),
    draft: getCurrentBooleanValue(frontmatter, 'draft', false),
    author: getCurrentBitsAuthorValue(frontmatter),
    images: getCurrentBitsImagesValue(frontmatter)
  };
};

const isEqualJsonValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const buildFrontmatterDiff = (
  fieldMatrix: readonly FrontmatterDiffField[]
): Pick<AdminWritePlan, 'changedFields' | 'patches'> => {
  const changedFields: string[] = [];
  const patches: FrontmatterPatch[] = [];

  for (const field of fieldMatrix) {
    if (isEqualJsonValue(field.currentValue, field.nextValue)) continue;
    changedFields.push(field.field);
    patches.push(
      field.nextValue === undefined
        ? { path: field.path, action: 'delete' }
        : { path: field.path, value: field.nextValue, action: 'set' }
    );
  }

  return { changedFields, patches };
};

const buildEssayWritePlan = async (
  state: AdminContentSourceState,
  values: AdminEssayEditorValues,
  bodyInput?: string,
  options: {
    publishedAtInputMode?: AdminEssayOptionalInputMode;
    updatedAtInputMode?: AdminEssayOptionalInputMode;
  } = {}
): Promise<AdminWritePlan> => {
  const current = buildEssayCurrentFrontmatter(state);
  const shouldPreservePublishedAt = options.publishedAtInputMode === 'missing';
  const shouldPreserveUpdatedAt = options.updatedAtInputMode === 'missing';
  const next = buildEssayFrontmatterFromValues(values, {
    ...(shouldPreservePublishedAt && current.preservedPublishedAt
      ? { preservedPublishedAt: current.preservedPublishedAt }
      : {}),
    ...(shouldPreserveUpdatedAt && current.preservedUpdatedAt
      ? { preservedUpdatedAt: current.preservedUpdatedAt }
      : {})
  });
  if (!next.frontmatter) {
    return { issues: next.issues, changedFields: [], patches: [] };
  }

  const slugIssues = await validateEssayPublicSlug(state, next.frontmatter);
  if (slugIssues.length > 0) {
    return { issues: slugIssues, changedFields: [], patches: [] };
  }

  if (bodyInput !== undefined) {
    const missingImageReferences = findMissingMarkdownBodyLocalImageReferences({
      bodyText: bodyInput,
      sourcePath: state.sourcePath
    });
    if (missingImageReferences.length > 0) {
      return {
        issues: missingImageReferences.map((reference) =>
          createIssue('body', `正文引用的本地图片不存在：${reference.relativePath}`)
        ),
        changedFields: [],
        patches: []
      };
    }
  }

  const fieldMatrix: FrontmatterDiffField[] = [
    { field: 'title', path: ['title'], currentValue: current.title, nextValue: next.frontmatter.title },
    { field: 'description', path: ['description'], currentValue: current.description, nextValue: next.frontmatter.description },
    { field: 'date', path: ['date'], currentValue: current.date, nextValue: next.frontmatter.date },
    { field: 'publishedAt', path: ['publishedAt'], currentValue: current.publishedAt, nextValue: next.frontmatter.publishedAt },
    { field: 'updatedAt', path: ['updatedAt'], currentValue: current.updatedAt, nextValue: next.frontmatter.updatedAt },
    { field: 'tags', path: ['tags'], currentValue: current.tags, nextValue: next.frontmatter.tags },
    { field: 'draft', path: ['draft'], currentValue: current.draft, nextValue: next.frontmatter.draft },
    { field: 'archive', path: ['archive'], currentValue: current.archive, nextValue: next.frontmatter.archive },
    { field: 'slug', path: ['slug'], currentValue: current.slug, nextValue: next.frontmatter.slug },
    { field: 'cover', path: ['cover'], currentValue: current.cover, nextValue: next.frontmatter.cover },
    { field: 'badge', path: ['badge'], currentValue: current.badge, nextValue: next.frontmatter.badge }
  ];

  const { changedFields, patches } = buildFrontmatterDiff(fieldMatrix);

  if (bodyInput !== undefined && bodyInput !== state.bodyText) {
    changedFields.push('body');
  }

  return {
    issues: [],
    changedFields,
    patches,
    ...(bodyInput !== undefined ? { bodyText: bodyInput } : {})
  };
};

const buildBitsWritePlan = (
  state: AdminContentSourceState,
  values: AdminBitsEditorValues,
  bodyInput?: string
): AdminWritePlan => {
  const next = buildBitsFrontmatterFromValues(values);
  if (!next.frontmatter) {
    return { issues: next.issues, changedFields: [], patches: [] };
  }

  const current = buildBitsCurrentFrontmatter(state);
  const fieldMatrix: FrontmatterDiffField[] = [
    { field: 'title', path: ['title'], currentValue: current.title, nextValue: next.frontmatter.title },
    { field: 'description', path: ['description'], currentValue: current.description, nextValue: next.frontmatter.description },
    { field: 'date', path: ['date'], currentValue: current.date, nextValue: next.frontmatter.date },
    { field: 'tags', path: ['tags'], currentValue: current.tags, nextValue: next.frontmatter.tags },
    { field: 'draft', path: ['draft'], currentValue: current.draft, nextValue: next.frontmatter.draft },
    { field: 'author', path: ['author'], currentValue: current.author, nextValue: next.frontmatter.author },
    { field: 'images', path: ['images'], currentValue: current.images, nextValue: next.frontmatter.images }
  ];

  const { changedFields, patches } = buildFrontmatterDiff(fieldMatrix);

  if (bodyInput !== undefined && bodyInput !== state.bodyText) {
    changedFields.push('body');
  }

  return {
    issues: [],
    changedFields,
    patches,
    ...(bodyInput !== undefined ? { bodyText: bodyInput } : {})
  };
};

const buildMemoWritePlan = (
  state: AdminContentSourceState,
  bodyInput?: string
): AdminWritePlan => {
  if (bodyInput !== undefined) {
    const missingImageReferences = findMissingMarkdownBodyLocalImageReferences({
      bodyText: bodyInput,
      sourcePath: state.sourcePath
    });
    if (missingImageReferences.length > 0) {
      return {
        issues: missingImageReferences.map((reference) =>
          createIssue('body', `正文引用的本地图片不存在：${reference.relativePath}`)
        ),
        changedFields: [],
        patches: []
      };
    }
  }

  const changedFields: string[] = [];
  if (bodyInput !== undefined && bodyInput !== state.bodyText) {
    changedFields.push('body');
  }

  return {
    issues: [],
    changedFields,
    patches: [],
    ...(bodyInput !== undefined ? { bodyText: bodyInput } : {})
  };
};

export const buildAdminContentWritePlanFromState = async (
  state: AdminContentSourceState,
  frontmatterInput: unknown,
  bodyInput?: string
): Promise<AdminWritePlan & { state: AdminContentSourceState }> => {
  const { collection } = state;
  if (!getAdminContentCollectionCapability(collection).entryWritable) {
    throw new AdminContentEntryResolutionError(
      'invalid-entry-id',
      getAdminContentReadOnlyReason(collection) ?? `当前 collection 暂不支持写盘：${collection}`
    );
  }

  if (collection === 'essay') {
    const parsed = parseAdminEssayEditorInput(frontmatterInput);
    if (!parsed.values) {
      return {
        state,
        issues: parsed.issues,
        changedFields: [],
        patches: []
      };
    }

    return {
      state,
      ...(await buildEssayWritePlan(state, parsed.values, bodyInput, {
        publishedAtInputMode: parsed.publishedAtInputMode,
        updatedAtInputMode: parsed.updatedAtInputMode
      }))
    };
  }

  if (collection === 'bits') {
    const parsed = parseAdminBitsEditorInput(frontmatterInput);
    if (!parsed.values) {
      return {
        state,
        issues: parsed.issues,
        changedFields: [],
        patches: []
      };
    }

    return {
      state,
      ...buildBitsWritePlan(state, parsed.values, bodyInput)
    };
  }

  if (collection === 'about') {
    return {
      state,
      ...buildAdminAboutWritePlan(state, bodyInput)
    };
  }

  return {
    state,
    ...buildMemoWritePlan(state, bodyInput)
  };
};

export const buildAdminContentWritePlan = async (
  collection: AdminContentEntryWriteCollectionKey,
  entryId: string,
  frontmatterInput: unknown,
  bodyInput?: string
): Promise<AdminWritePlan & { state: AdminContentSourceState }> =>
  buildAdminContentWritePlanFromState(
    await loadAdminContentSourceState(collection, entryId),
    frontmatterInput,
    bodyInput
  );

export const applyAdminContentWritePlan = (
  state: Pick<AdminContentSourceState, 'sourceText'>,
  patches: readonly FrontmatterPatch[],
  bodyText?: string
): string => {
  const nextSourceText = patchMarkdownFrontmatter(state.sourceText, patches);
  return bodyText === undefined ? nextSourceText : replaceMarkdownBody(nextSourceText, bodyText);
};
