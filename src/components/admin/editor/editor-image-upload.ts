import {
  getPayloadErrors,
  isPayloadOk,
  isRecord,
  parseResponseBody
} from '../../../scripts/admin-content/entry-transport';
import type { AdminContentWriteCollectionKey } from '../../../lib/admin-console/content-shared';

export type EditorImageUploadResult = {
  src: string;
  path: string;
  fileName: string;
  width: number | null;
  height: number | null;
  size: number | null;
  mimeType: string | null;
};

export type EditorImageUploadInput = {
  uploadEndpoint: string;
  collection: AdminContentWriteCollectionKey;
  entryId: string;
  file: File;
};

export type EditorImageUploadResponse =
  | {
      ok: true;
      result: EditorImageUploadResult;
    }
  | {
      ok: false;
      error: string;
    };

const getEditorImageUploadResult = (value: unknown): EditorImageUploadResult | null => {
  if (!isRecord(value) || !isRecord(value.result)) return null;
  const result = value.result;
  if (typeof result.src !== 'string' || typeof result.path !== 'string' || typeof result.fileName !== 'string') {
    return null;
  }

  return {
    src: result.src,
    path: result.path,
    fileName: result.fileName,
    width: typeof result.width === 'number' ? result.width : null,
    height: typeof result.height === 'number' ? result.height : null,
    size: typeof result.size === 'number' ? result.size : null,
    mimeType: typeof result.mimeType === 'string' ? result.mimeType : null
  };
};

export const uploadContentEditorImage = async ({
  uploadEndpoint,
  collection,
  entryId,
  file
}: EditorImageUploadInput): Promise<EditorImageUploadResponse> => {
  try {
    const formData = new FormData();
    formData.set('collection', collection);
    formData.set('entryId', entryId);
    formData.set('image', file);

    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json'
      },
      cache: 'no-store',
      body: formData
    });

    const payload = await parseResponseBody(response);
    const result = getEditorImageUploadResult(payload);
    if (!response.ok || !isPayloadOk(payload) || !result) {
      return {
        ok: false,
        error: getPayloadErrors(payload)[0] ?? '图片上传失败'
      };
    }

    return { ok: true, result };
  } catch {
    return {
      ok: false,
      error: '图片上传请求失败'
    };
  }
};

export const uploadEssayEditorImage = (
  input: Omit<EditorImageUploadInput, 'collection'>
): Promise<EditorImageUploadResponse> =>
  uploadContentEditorImage({ ...input, collection: 'essay' });

export const uploadBitsEditorImage = (
  input: Omit<EditorImageUploadInput, 'collection'>
): Promise<EditorImageUploadResponse> =>
  uploadContentEditorImage({ ...input, collection: 'bits' });
