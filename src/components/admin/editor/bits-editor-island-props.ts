import type { AdminBitsEditorValues } from '../../../lib/admin-console/content-shared';
import type { BitsCardAuthorInput } from '../../../lib/bits-card-view-model';
import type { EditorOutlineListSourceItem } from './editor-outline-helpers';

export type BitsEditorIslandProps = {
  endpoint: string;
  exportEndpoint: string;
  deleteEndpoint: string;
  previewEndpoint: string;
  imageUploadEndpoint: string;
  returnHref: string;
  entryId: string;
  relativePath: string;
  defaultPublicSlug: string;
  revision: string;
  initialFrontmatter: AdminBitsEditorValues;
  initialBody: string;
  defaultAuthor: BitsCardAuthorInput;
  bitsOutlineItems?: EditorOutlineListSourceItem[];
};
