export function formatISODate(d: Date): string {
  // yyyy-mm-dd
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatISODateUtc(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatMonthDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

export function formatMonthDayUtc(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

export function createWithBase(base: string) {
  const baseNormalized = base.endsWith('/') ? base : `${base}/`;
  return (path: string) => {
    if (!path || path === '/') return baseNormalized;
    if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:'))
      return path;
    const clean = path.startsWith('/') ? path.slice(1) : path;
    return `${baseNormalized}${clean}`;
  };
}

export function toSafeHttpUrl(value: string, base?: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const parsed = base ? new URL(trimmed, base) : new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

const HERO_IMAGE_LOCAL_EXT_RE = /\.(?:avif|gif|jpe?g|png|webp)$/i;
const BITS_AVATAR_LOCAL_EXT_RE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

const hasInvalidLocalImagePathSegment = (value: string): boolean =>
  /(^|\/)\.\.(?:\/|$)/.test(value) ||
  value.includes('?') ||
  value.includes('#');

const toCanonicalHeroAssetPath = (value: string): string | null => {
  if (value.startsWith('@/assets/')) {
    return `src/assets/${value.slice('@/assets/'.length)}`;
  }

  if (value.startsWith('assets/')) {
    return `src/assets/${value.slice('assets/'.length)}`;
  }

  return value.startsWith('src/assets/') ? value : null;
};

export function normalizeHeroImageSrc(
  value: unknown
): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const safeRemoteUrl = toSafeHttpUrl(trimmed);
  if (safeRemoteUrl) return safeRemoteUrl;

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (
    !normalized ||
    normalized.startsWith('//') ||
    hasInvalidLocalImagePathSegment(normalized)
  ) {
    return undefined;
  }

  if (normalized.startsWith('/')) {
    return normalized !== '/' && HERO_IMAGE_LOCAL_EXT_RE.test(normalized)
      ? normalized
      : undefined;
  }

  if (normalized.startsWith('public/')) {
    const publicPath = `/${normalized.slice('public/'.length)}`;
    return publicPath !== '/' && HERO_IMAGE_LOCAL_EXT_RE.test(publicPath)
      ? publicPath
      : undefined;
  }

  const assetPath = toCanonicalHeroAssetPath(normalized);
  return assetPath && HERO_IMAGE_LOCAL_EXT_RE.test(assetPath)
    ? assetPath
    : undefined;
}

export function getHeroImageLocalFilePath(value: string): string | null {
  if (value.startsWith('src/assets/')) return value;
  if (value.startsWith('/')) return `public${value}`;
  return null;
}

export function normalizeBitsAvatarPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return '';

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    normalized.startsWith('public/') ||
    /^[A-Za-z]+:\/\//.test(normalized) ||
    hasInvalidLocalImagePathSegment(normalized)
  ) {
    return undefined;
  }

  return BITS_AVATAR_LOCAL_EXT_RE.test(normalized) ? normalized : undefined;
}

export function getBitsAvatarLocalFilePath(value: string): string | null {
  if (!value) return null;
  return `public/${value}`;
}

export function tokenizeSearchQuery(query: string): string[] {
  return Array.from(
    new Set(
      query
        .split(/\s+/)
        .map((term) => term.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export function buildSearchHaystack(
  parts: ReadonlyArray<string | readonly string[] | null | undefined>
): string {
  const normalizedParts: string[] = [];

  for (const part of parts) {
    if (Array.isArray(part)) {
      for (const value of part) {
        const normalized = typeof value === 'string' ? value.trim() : '';
        if (normalized) normalizedParts.push(normalized);
      }
      continue;
    }

    const normalized = typeof part === 'string' ? part.trim() : '';
    if (normalized) normalizedParts.push(normalized);
  }

  return normalizedParts.join(' ').toLowerCase();
}

type JsonIndexLoaderOptions<T> = {
  url: string;
  shouldBypassCache?: boolean;
  onPending?: () => void;
  onResolved?: (data: T[]) => void;
  onRejected?: () => void;
};

export function createJsonIndexLoader<T>(options: JsonIndexLoaderOptions<T>) {
  let indexPromise: Promise<T[] | null> | null = null;
  let indexCache: T[] | null = null;
  let indexFailed = false;

  const load = async (): Promise<T[] | null> => {
    if (!options.url) return null;
    if (indexCache) return indexCache;
    if (indexFailed) return null;

    if (!indexPromise) {
      options.onPending?.();
      indexPromise = fetch(options.url, {
        cache: options.shouldBypassCache ? 'no-store' : 'default',
      })
        .then((response) => {
          if (!response.ok) throw new Error('index fetch failed');
          return response.json();
        })
        .then((data) => {
          if (!Array.isArray(data)) throw new Error('index data invalid');
          indexCache = data as T[];
          options.onResolved?.(indexCache);
          return indexCache;
        })
        .catch(() => {
          indexFailed = true;
          options.onRejected?.();
          return null;
        });
    }

    return indexPromise;
  };

  return {
    load,
    getCached: () => indexCache,
    hasFailed: () => indexFailed,
  };
}

export function createDebouncedAsyncRunner(
  run: () => void | Promise<void>,
  defaultDelay = 0
) {
  let timer: number | null = null;

  const cancel = () => {
    if (timer === null) return;
    window.clearTimeout(timer);
    timer = null;
  };

  const schedule = (delay = defaultDelay) => {
    cancel();
    timer = window.setTimeout(() => {
      timer = null;
      void run();
    }, delay);
  };

  return {
    schedule,
    cancel,
  };
}

export function groupByYear<T>(items: T[], getDate: (item: T) => Date) {
  const map = new Map<number, T[]>();
  for (const it of items) {
    const y = getDate(it).getFullYear();
    const arr = map.get(y) ?? [];
    arr.push(it);
    map.set(y, arr);
  }

  // Return as array sorted by year desc.
  return Array.from(map.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, list]) => ({
      year,
      list: list.sort((a, b) => getDate(b).valueOf() - getDate(a).valueOf()),
    }));
}

export function groupByUtcYear<T>(items: T[], getDate: (item: T) => Date) {
  const map = new Map<number, T[]>();
  for (const it of items) {
    const y = getDate(it).getUTCFullYear();
    const arr = map.get(y) ?? [];
    arr.push(it);
    map.set(y, arr);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, list]) => ({
      year,
      list: list.sort((a, b) => getDate(b).valueOf() - getDate(a).valueOf()),
    }));
}

export function formatDateTime(d: Date): string {
  const yyyyMmDd = formatISODate(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yyyyMmDd} ${hh}:${mm}`;
}

export function joinPageSubtitleText(
  ...parts: Array<string | null | undefined>
): string | null {
  const normalized = parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);

  return normalized.length ? normalized.join(' · ') : null;
}
