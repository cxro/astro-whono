import type { AdminBitsEditorValues } from '../../../lib/admin-console/content-shared';
import type { BitsCardImageInput } from '../../../lib/bits-card-view-model';
import type { BitsImageRowDraft } from './bits-image-rows';

export const getBitsEditorTags = (tagsText: string): string[] =>
  tagsText
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter(Boolean);

export const getBitsEditorImages = (rows: readonly BitsImageRowDraft[]): BitsCardImageInput[] =>
  rows
    .map((row) => ({
      src: row.src.trim(),
      width: row.width.trim(),
      height: row.height.trim(),
      alt: row.alt.trim()
    }))
    .filter((row) => Boolean(row.src));

export const getBitsEditorAuthor = (values: AdminBitsEditorValues) => ({
  name: values.authorName,
  avatar: values.authorAvatar
});
