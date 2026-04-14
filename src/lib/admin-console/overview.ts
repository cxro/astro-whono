import { PAGE_SIZE_BITS } from '../../../site.config.mjs';
import {
  getBitAnchorId,
  getBitsPagePath,
  getBitSlug,
  getBitsDerivedText,
  getSortedBits,
  type BitsEntry
} from '../bits';
import {
  getEssayDerivedText,
  getEssaySlug,
  getMemoDerivedText,
  getPublished,
  getSortedEssays,
  isReservedSlug,
  type EssayEntry,
  type MemoEntry
} from '../content';
import { collectTagSummary, getTagPath } from '../tags';
import { formatDateTime, formatISODate, formatISODateUtc } from '../../utils/format';
import { cleanMarkdownToText } from '../../utils/excerpt';
import packageJson from '../../../package.json';

export type AdminOverviewCollectionKey = 'essay' | 'bits' | 'memo';

export type AdminOverviewDataOptions = {
  includeMaintainer: boolean;
  includeDraftInRecent: boolean;
  isDev?: boolean;
  now?: Date;
  env?: Record<string, string | undefined>;
};

export type AdminOverviewSourceOptions = Pick<AdminOverviewDataOptions, 'includeMaintainer'>;

export type AdminOverviewSource = {
  public: AdminOverviewPublicSource;
  maintainer: AdminOverviewMaintainerSource | null;
};

export type AdminOverviewPublicSource = {
  essays: EssayEntry[];
  archiveEssays: EssayEntry[];
  bits: BitsEntry[];
  memos: MemoEntry[];
  bitsHrefById: Map<string, string>;
};

export type AdminOverviewMaintainerSource = {
  essays: EssayEntry[];
  bits: BitsEntry[];
  memos: MemoEntry[];
};

export type AdminOverviewStats = {
  publishedCount: number;
  tagCount: number;
  wordCount: number;
  lastUpdate: {
    date: Date;
    dateLabel: string;
  } | null;
};

export type AdminOverviewCollectionShare = {
  key: AdminOverviewCollectionKey;
  label: string;
  detail: string;
  count: number;
  percentage: number;
  percentageLabel: string;
};

export type AdminOverviewTagSummary = {
  key: string;
  label: string;
  count: number;
  href: string;
};

export type AdminOverviewActivityDay = {
  date: string;
  dateLabel: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

export type AdminOverviewRecentPublication = {
  collection: AdminOverviewCollectionKey;
  collectionLabel: string;
  title: string;
  href: string | null;
  isDraft: boolean;
  date: Date | null;
  dateLabel: string;
  shortDateLabel: string;
};

export type AdminOverviewSystemStatusItemKey =
  | 'runtime'
  | 'hostTarget'
  | 'engine'
  | 'lastBuild';

export type AdminOverviewSystemStatusItem = {
  key: AdminOverviewSystemStatusItemKey;
  label: string;
  value: string;
  dateTime?: string;
};

export type AdminOverviewSystemStatus = {
  statusLabel: string;
  items: AdminOverviewSystemStatusItem[];
  activity: AdminOverviewActivityDay[];
};

export type AdminOverviewPublicSummary = {
  stats: AdminOverviewStats;
  collections: AdminOverviewCollectionShare[];
  topTags: AdminOverviewTagSummary[];
  writingActivity: AdminOverviewActivityDay[];
  recentPublications: AdminOverviewRecentPublication[];
};

type AdminOverviewPublicSummaryOptions = Pick<AdminOverviewDataOptions, 'now'>;

export type AdminOverviewCollectionDraftSummary = {
  key: AdminOverviewCollectionKey;
  label: string;
  draftCount: number;
  totalCount: number;
};

export type AdminOverviewMaintainerSummary = {
  draftCount: number;
  collectionDrafts: AdminOverviewCollectionDraftSummary[];
  recentDraftCount: number;
  recentPublications: AdminOverviewRecentPublication[];
};

export type AdminOverviewData = AdminOverviewPublicSummary & {
  systemStatus: AdminOverviewSystemStatus;
  maintainerSummary: AdminOverviewMaintainerSummary | null;
};

type RecentSource = {
  essays: EssayEntry[];
  bits: BitsEntry[];
  memos: MemoEntry[];
  bitsHrefById: ReadonlyMap<string, string>;
};

const COLLECTION_LABELS: Record<AdminOverviewCollectionKey, string> = {
  essay: 'Essay',
  bits: 'Bits',
  memo: 'Memo'
};

const COLLECTION_DETAILS: Record<AdminOverviewCollectionKey, string> = {
  essay: '随笔',
  bits: '动态',
  memo: '小记'
};

const RECENT_LIMIT = 6;
const TOP_TAG_LIMIT = 8;
const ACTIVITY_DAY_COUNT = 90;
const SYSTEM_STATUS_ACTIVITY_DAY_COUNT = 14;
const WORD_COUNT_COMPACT_THRESHOLD = 100_000;
const WORD_COUNT_COMPACT_UNIT = 10_000;
const WORD_TOKEN_REGEX =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[A-Za-z0-9]+/gu;
const ASTRO_VERSION = String(packageJson.dependencies?.astro ?? 'unknown').replace(/^[~^]/, '');

const DEPLOY_TARGET_LABELS = {
  'cloudflare-pages': 'Cloudflare Pages',
  vercel: 'Vercel',
  'github-pages': 'GitHub Pages',
  'static-host': 'Static Host'
} as const;

type AdminOverviewDeployTarget = keyof typeof DEPLOY_TARGET_LABELS;

const DEPLOY_TARGET_ALIASES = new Map<string, AdminOverviewDeployTarget>([
  ['cf', 'cloudflare-pages'],
  ['cloudflare', 'cloudflare-pages'],
  ['cloudflare-pages', 'cloudflare-pages'],
  ['vercel', 'vercel'],
  ['gh-pages', 'github-pages'],
  ['github', 'github-pages'],
  ['github-pages', 'github-pages'],
  ['static', 'static-host'],
  ['static-host', 'static-host']
]);

const orderByNullableDateDesc = (left: Date | null, right: Date | null): number =>
  (right?.valueOf() ?? -Infinity) - (left?.valueOf() ?? -Infinity);

const orderByMemoDate = (a: MemoEntry, b: MemoEntry): number =>
  orderByNullableDateDesc(a.data.date ?? null, b.data.date ?? null);

const formatCompactDate = (date: Date) => formatISODate(date).replace(/-/g, '.');
const formatCompactDateUtc = (date: Date) => formatISODateUtc(date).replace(/-/g, '.');

const formatShortDate = (date: Date | null, useUtc = false): string => {
  if (!date) return '--.--';
  const source = useUtc ? formatISODateUtc(date) : formatISODate(date);
  return source.slice(5).replace('-', '.');
};

const getCollectionDraftCount = (
  entries: readonly EssayEntry[] | readonly BitsEntry[] | readonly MemoEntry[]
): number => entries.filter((entry) => entry.data.draft === true).length;

const filterPublishedEntries = <Entry extends { data: { draft?: boolean } }>(
  entries: readonly Entry[]
): Entry[] => entries.filter((entry) => entry.data.draft !== true);

const filterArchiveEssays = (essays: readonly EssayEntry[]): EssayEntry[] =>
  essays.filter((entry) => entry.data.archive !== false && !isReservedSlug(getEssaySlug(entry)));

const getPercentage = (count: number, total: number): number => {
  if (total <= 0 || count <= 0) return 0;
  return Math.round((count / total) * 100);
};

export const buildAdminOverviewBitsHrefById = (bits: readonly BitsEntry[]): Map<string, string> =>
  new Map(
    bits.map((entry, index) => {
      const page = Math.floor(index / PAGE_SIZE_BITS) + 1;
      return [entry.id, `${getBitsPagePath(page)}#${getBitAnchorId(entry.id)}`];
    })
  );

const getRecentEssayPublication = (entry: EssayEntry): AdminOverviewRecentPublication => {
  const isDraft = entry.data.draft === true;
  return {
    collection: 'essay',
    collectionLabel: COLLECTION_LABELS.essay,
    title: entry.data.title,
    href: isDraft ? null : `/archive/${getEssaySlug(entry)}/`,
    isDraft,
    date: entry.data.date,
    dateLabel: formatCompactDateUtc(entry.data.date),
    shortDateLabel: formatShortDate(entry.data.date, true)
  };
};

const getRecentBitsPublication = (
  entry: BitsEntry,
  bitsHrefById: ReadonlyMap<string, string>
): AdminOverviewRecentPublication => {
  const isDraft = entry.data.draft === true;
  const title = entry.data.title?.trim()
    || entry.data.description?.trim()
    || (isDraft ? 'Untitled bit' : getBitSlug(entry));

  return {
    collection: 'bits',
    collectionLabel: COLLECTION_LABELS.bits,
    title,
    href: isDraft ? null : bitsHrefById.get(entry.id) ?? null,
    isDraft,
    date: entry.data.date,
    dateLabel: formatDateTime(entry.data.date),
    shortDateLabel: formatShortDate(entry.data.date)
  };
};

const getRecentMemoPublication = (entry: MemoEntry): AdminOverviewRecentPublication => {
  const isDraft = entry.data.draft === true;
  return {
    collection: 'memo',
    collectionLabel: COLLECTION_LABELS.memo,
    title: entry.data.title,
    href: isDraft ? null : '/memo/',
    isDraft,
    date: entry.data.date ?? null,
    dateLabel: entry.data.date ? formatCompactDate(entry.data.date) : '未设置日期',
    shortDateLabel: formatShortDate(entry.data.date ?? null)
  };
};

const buildRecentPublications = (source: RecentSource): AdminOverviewRecentPublication[] =>
  [
    ...source.essays.map((entry) => getRecentEssayPublication(entry)),
    ...source.bits.map((entry) => getRecentBitsPublication(entry, source.bitsHrefById)),
    ...source.memos.map((entry) => getRecentMemoPublication(entry))
  ]
    .sort((left, right) => orderByNullableDateDesc(left.date, right.date))
    .slice(0, RECENT_LIMIT);

const getLatestUpdate = (source: AdminOverviewPublicSource): AdminOverviewStats['lastUpdate'] => {
  const candidates = [
    ...source.essays.map((entry) => ({
      date: entry.data.date,
      dateLabel: formatCompactDateUtc(entry.data.date)
    })),
    ...source.bits.map((entry) => ({
      date: entry.data.date,
      dateLabel: formatCompactDate(entry.data.date)
    })),
    ...source.memos
      .filter((entry) => entry.data.date)
      .map((entry) => ({
        date: entry.data.date as Date,
        dateLabel: formatCompactDate(entry.data.date as Date)
      }))
  ].sort((left, right) => orderByNullableDateDesc(left.date, right.date));

  const latest = candidates[0];
  return latest ? { date: latest.date, dateLabel: latest.dateLabel } : null;
};

const buildCollectionShares = (source: AdminOverviewPublicSource): AdminOverviewCollectionShare[] => {
  const total = source.essays.length + source.bits.length + source.memos.length;
  const counts: Record<AdminOverviewCollectionKey, number> = {
    essay: source.essays.length,
    bits: source.bits.length,
    memo: source.memos.length
  };

  return (Object.keys(counts) as AdminOverviewCollectionKey[]).map((key) => {
    const percentage = getPercentage(counts[key], total);
    return {
      key,
      label: COLLECTION_LABELS[key],
      detail: COLLECTION_DETAILS[key],
      count: counts[key],
      percentage,
      percentageLabel: `${percentage}%`
    };
  });
};

const countAdminOverviewTextWords = (text: string): number =>
  text.match(WORD_TOKEN_REGEX)?.length ?? 0;

export const countAdminOverviewWords = (markdown: string): number => {
  const text = cleanMarkdownToText(markdown);
  return countAdminOverviewTextWords(text);
};

export const formatAdminOverviewWordMetric = (wordCount: number): { value: string; suffix: string } => {
  if (wordCount <= WORD_COUNT_COMPACT_THRESHOLD) {
    return {
      value: String(wordCount),
      suffix: '字'
    };
  }

  return {
    value: (wordCount / WORD_COUNT_COMPACT_UNIT).toFixed(1),
    suffix: '万字'
  };
};

const buildAdminOverviewWordCount = (source: AdminOverviewPublicSource): number =>
  source.essays.reduce(
    (total, entry) => total + countAdminOverviewTextWords(getEssayDerivedText(entry).plainText),
    0
  )
  + source.bits.reduce(
    (total, entry) => total + countAdminOverviewTextWords(getBitsDerivedText(entry).plainText),
    0
  )
  + source.memos.reduce(
    (total, entry) => total + countAdminOverviewTextWords(getMemoDerivedText(entry).plainText),
    0
  );

const getActivityLevel = (count: number): AdminOverviewActivityDay['level'] => {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
};

const createUtcDate = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const addUtcDays = (date: Date, offset: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + offset));

const normalizeDeployTarget = (value: string | undefined): AdminOverviewDeployTarget | null => {
  const normalized = value?.trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (!normalized) return null;
  return DEPLOY_TARGET_ALIASES.get(normalized) ?? null;
};

const getHostTargetLabel = (env: Record<string, string | undefined>): string => {
  const explicitTarget = normalizeDeployTarget(env.DEPLOY_TARGET);
  if (explicitTarget) return DEPLOY_TARGET_LABELS[explicitTarget];
  if (env.CF_PAGES === '1' || env.CF_PAGES === 'true') return DEPLOY_TARGET_LABELS['cloudflare-pages'];
  if (env.VERCEL === '1' || env.VERCEL === 'true') return DEPLOY_TARGET_LABELS.vercel;
  if (env.GITHUB_ACTIONS === 'true') return 'GitHub Actions';
  return DEPLOY_TARGET_LABELS['static-host'];
};

const formatBuildDateLabel = (date: Date): string => formatDateTime(date);

const buildWritingActivity = (
  essays: readonly EssayEntry[],
  bits: readonly BitsEntry[],
  now: Date = new Date()
): AdminOverviewActivityDay[] => {
  const datedEntries = [
    ...essays.map((entry) => entry.data.date),
    ...bits.map((entry) => entry.data.date)
  ];
  if (datedEntries.length === 0) return [];

  const anchor = createUtcDate(now);
  const counts = new Map<string, number>();

  for (const date of datedEntries) {
    const key = formatISODateUtc(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: ACTIVITY_DAY_COUNT }, (_, index) => {
    const date = addUtcDays(anchor, index - (ACTIVITY_DAY_COUNT - 1));
    const key = formatISODateUtc(date);
    const count = counts.get(key) ?? 0;
    return {
      date: key,
      dateLabel: key,
      count,
      level: getActivityLevel(count)
    };
  });
};

export const buildAdminOverviewSystemStatus = (
  activity: readonly AdminOverviewActivityDay[],
  options: Pick<AdminOverviewDataOptions, 'env' | 'isDev' | 'now'>
): AdminOverviewSystemStatus => {
  const isDev = options.isDev === true;
  const buildDate = options.now ?? new Date();
  const buildDateTime = buildDate.toISOString();
  const env = options.env ?? process.env;

  return {
    statusLabel: isDev ? 'Dev Ready' : 'Static Ready',
    activity: activity.slice(-SYSTEM_STATUS_ACTIVITY_DAY_COUNT),
    items: [
      {
        key: 'runtime',
        label: 'Runtime',
        value: isDev ? 'Dev' : 'Static'
      },
      {
        key: 'hostTarget',
        label: 'Host Target',
        value: getHostTargetLabel(env)
      },
      {
        key: 'engine',
        label: 'Engine',
        value: `Astro ${ASTRO_VERSION}`
      },
      {
        key: 'lastBuild',
        label: 'Last Build',
        value: formatBuildDateLabel(buildDate),
        dateTime: buildDateTime
      }
    ]
  };
};

export const buildAdminOverviewPublicSummary = (
  source: AdminOverviewPublicSource,
  options: AdminOverviewPublicSummaryOptions = {}
): AdminOverviewPublicSummary => {
  const topTags = collectTagSummary(source.archiveEssays);

  return {
    stats: {
      publishedCount: source.essays.length + source.bits.length + source.memos.length,
      tagCount: topTags.length,
      wordCount: buildAdminOverviewWordCount(source),
      lastUpdate: getLatestUpdate(source)
    },
    collections: buildCollectionShares(source),
    topTags: topTags.slice(0, TOP_TAG_LIMIT).map((tag) => ({
      key: tag.key,
      label: tag.label,
      count: tag.count,
      href: getTagPath('archive', tag.key)
    })),
    writingActivity: buildWritingActivity(source.essays, source.bits, options.now),
    recentPublications: buildRecentPublications(source)
  };
};

export const buildAdminOverviewMaintainerSummary = (
  source: AdminOverviewMaintainerSource | null,
  bitsHrefById: ReadonlyMap<string, string>
): AdminOverviewMaintainerSummary | null => {
  if (!source) return null;

  const collectionDrafts: AdminOverviewCollectionDraftSummary[] = [
    {
      key: 'essay',
      label: COLLECTION_LABELS.essay,
      draftCount: getCollectionDraftCount(source.essays),
      totalCount: source.essays.length
    },
    {
      key: 'bits',
      label: COLLECTION_LABELS.bits,
      draftCount: getCollectionDraftCount(source.bits),
      totalCount: source.bits.length
    },
    {
      key: 'memo',
      label: COLLECTION_LABELS.memo,
      draftCount: getCollectionDraftCount(source.memos),
      totalCount: source.memos.length
    }
  ];
  const recentPublications = buildRecentPublications({
    essays: source.essays,
    bits: source.bits,
    memos: source.memos,
    bitsHrefById
  });

  return {
    draftCount: collectionDrafts.reduce((total, summary) => total + summary.draftCount, 0),
    collectionDrafts,
    recentDraftCount: recentPublications.filter((entry) => entry.isDraft).length,
    recentPublications
  };
};

export const loadAdminOverviewSource = async (
  options: AdminOverviewSourceOptions
): Promise<AdminOverviewSource> => {
  const includeDraft = options.includeMaintainer;
  const [sourceEssays, sourceBits, sourceMemos] = await Promise.all([
    getSortedEssays({ includeDraft }),
    getSortedBits({ includeDraft }),
    getPublished('memo', { includeDraft, orderBy: orderByMemoDate })
  ]);
  const essays = filterPublishedEntries(sourceEssays);
  const bits = filterPublishedEntries(sourceBits);
  const memos = filterPublishedEntries(sourceMemos);

  const publicSource: AdminOverviewPublicSource = {
    essays,
    archiveEssays: filterArchiveEssays(essays),
    bits,
    memos,
    bitsHrefById: buildAdminOverviewBitsHrefById(bits)
  };

  if (!options.includeMaintainer) {
    return {
      public: publicSource,
      maintainer: null
    };
  }

  return {
    public: publicSource,
    maintainer: {
      essays: sourceEssays,
      bits: sourceBits,
      memos: sourceMemos
    }
  };
};

export const getAdminOverviewData = async (
  options: AdminOverviewDataOptions
): Promise<AdminOverviewData> => {
  const source = await loadAdminOverviewSource({ includeMaintainer: options.includeMaintainer });
  const publicSummary = buildAdminOverviewPublicSummary(
    source.public,
    options.now === undefined ? undefined : { now: options.now }
  );
  const maintainerSummary = buildAdminOverviewMaintainerSummary(
    source.maintainer,
    source.public.bitsHrefById
  );
  const systemStatusOptions: Pick<AdminOverviewDataOptions, 'env' | 'isDev' | 'now'> = {
    isDev: options.isDev ?? options.includeMaintainer
  };
  if (options.env) systemStatusOptions.env = options.env;
  if (options.now) systemStatusOptions.now = options.now;

  return {
    ...publicSummary,
    systemStatus: buildAdminOverviewSystemStatus(publicSummary.writingActivity, systemStatusOptions),
    recentPublications: options.includeDraftInRecent && maintainerSummary
      ? maintainerSummary.recentPublications
      : publicSummary.recentPublications,
    maintainerSummary
  };
};
