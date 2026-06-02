export type BitsImageRowDraft = {
  src: string;
  width: string;
  height: string;
  alt: string;
};

type BitsImageRowRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is BitsImageRowRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export const createEmptyBitsImageRow = (): BitsImageRowDraft => ({
  src: '',
  width: '',
  height: '',
  alt: ''
});

export const parseBitsImageRows = (value: string): BitsImageRowDraft[] => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isRecord)
      .map((item) => ({
        src: toText(item.src),
        width: toText(item.width),
        height: toText(item.height),
        alt: toText(item.alt)
      }));
  } catch {
    return [];
  }
};

export const getEditableBitsImageRows = (value: string): BitsImageRowDraft[] => {
  const rows = parseBitsImageRows(value);
  return rows.length > 0 ? rows : [createEmptyBitsImageRow()];
};

export const serializeBitsImageRows = (rows: readonly BitsImageRowDraft[]): string => {
  const items = rows
    .map((row) => {
      const src = row.src.trim();
      const width = row.width.trim();
      const height = row.height.trim();
      const alt = row.alt.trim();
      if (!src && !width && !height && !alt) return null;

      return {
        ...(src ? { src } : {}),
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
        ...(alt ? { alt } : {})
      };
    })
    .filter((item): item is Record<string, string> => item !== null);

  return items.length > 0 ? JSON.stringify(items, null, 2) : '';
};
