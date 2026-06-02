import type { AdminEssayEditorValues } from '../../../lib/admin-console/content-shared';
import type { EditorOutlineEssaySourceItem } from './editor-outline-helpers';

type BaseEssayEditorShellProps = {
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
  initialArticleInfoOpen?: boolean;
};

export type EssayEditorShellProps = BaseEssayEditorShellProps & {
  initialFrontmatter: AdminEssayEditorValues;
  initialBody: string;
  essayOutlineItems?: EditorOutlineEssaySourceItem[];
};
