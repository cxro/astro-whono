type TagContainer = {
  id?: string;
  data?: {
    tags?: string[] | null | undefined;
  } | null;
};

export type TagSummary = {
  key: string;
  label: string;
  count: number;
};

export type TagScope = 'archive';

const SPACE_RE = /\s+/g;
const TAG_KEY_RE = /[\s/\\?#%]+/g;
const TRIM_DASH_RE = /^-+|-+$/g;
const NON_ROUTABLE_TAG_KEY_RE = /[\s/\\?#%]/;
const TAG_LABEL_COLLATOR = new Intl.Collator('zh-CN', {
  sensitivity: 'variant',
  numeric: true,
});

const compareTagLabel = (a: string, b: string) =>
  TAG_LABEL_COLLATOR.compare(a, b);

const pickPreferredTagLabel = (current: string, candidate: string) =>
  compareTagLabel(candidate, current) < 0 ? candidate : current;

export function normalizeTagLabel(raw: string): string {
  return raw.normalize('NFKC').replace(SPACE_RE, ' ').trim();
}

export function toTagKey(label: string): string {
  return normalizeTagLabel(label)
    .toLowerCase()
    .replace(TAG_KEY_RE, '-')
    .replace(TRIM_DASH_RE, '');
}

export function isRoutableTagKey(key: string): boolean {
  return (
    key.length > 0 &&
    key !== '.' &&
    key !== '..' &&
    !NON_ROUTABLE_TAG_KEY_RE.test(key)
  );
}

const assertRoutableTagKey = (
  entryId: string | undefined,
  label: string,
  key: string
): void => {
  if (isRoutableTagKey(key)) return;

  throw new Error(
    [
      'Invalid archive tag key detected.',
      `  Entry:       ${entryId ?? '(unknown entry)'}`,
      `  Tag label:   ${JSON.stringify(label)}`,
      `  Route key:   ${key ? JSON.stringify(key) : '(empty)'}`,
      '  Reason:      archive tag keys must normalize to one routable segment and cannot be "." or "..".',
      '  How to fix:  rename the tag so it does not collapse to an empty / reserved / non-routable route segment.',
    ].join('\n')
  );
};

export function getTagKeys(
  tags: readonly string[] | null | undefined
): string[] {
  if (!Array.isArray(tags) || tags.length === 0) return [];

  const keys: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const normalized = normalizeTagLabel(raw);
    if (!normalized) continue;

    const key = toTagKey(normalized);
    if (!isRoutableTagKey(key) || seen.has(key)) continue;

    keys.push(key);
    seen.add(key);
  }
  return keys;
}

export function collectTagSummary<T extends TagContainer>(
  entries: readonly T[]
): TagSummary[] {
  const map = new Map<string, TagSummary>();

  for (const entry of entries) {
    const tags = Array.isArray(entry.data?.tags) ? entry.data?.tags : [];
    const entryLabels = new Map<string, string>();

    for (const raw of tags) {
      if (typeof raw !== 'string') continue;
      const label = normalizeTagLabel(raw);
      if (!label) continue;

      const key = toTagKey(label);
      assertRoutableTagKey(entry.id, label, key);
      const entryLabel = entryLabels.get(key);
      entryLabels.set(
        key,
        entryLabel ? pickPreferredTagLabel(entryLabel, label) : label
      );
    }

    for (const [key, label] of entryLabels) {
      const current = map.get(key);
      if (current) {
        current.count += 1;
        current.label = pickPreferredTagLabel(current.label, label);
        continue;
      }

      map.set(key, {
        key,
        label,
        count: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return compareTagLabel(a.label, b.label);
  });
}

export function hasTagKey(
  tags: readonly string[] | null | undefined,
  key: string
): boolean {
  if (!isRoutableTagKey(key)) return false;
  return getTagKeys(tags).includes(key);
}

export function filterEntriesByTag<T extends TagContainer>(
  entries: readonly T[],
  key: string
): T[] {
  if (!isRoutableTagKey(key)) return [];
  return entries.filter((entry) => hasTagKey(entry.data?.tags, key));
}

export function findTagSummary(
  tagSummaries: readonly TagSummary[],
  rawKey: string
): TagSummary | null {
  const key = toTagKey(rawKey);
  if (!isRoutableTagKey(key)) return null;
  return tagSummaries.find((tagSummary) => tagSummary.key === key) ?? null;
}

export function getTagPath(scope: TagScope, rawKey: string, page = 1): string {
  const key = toTagKey(rawKey);
  if (!isRoutableTagKey(key)) return `/${scope}/`;
  return page <= 1
    ? `/${scope}/tag/${key}/`
    : `/${scope}/tag/${key}/page/${page}/`;
}
