import rss from '@astrojs/rss';
import { getArchiveEssays, getEssaySlug } from '../../lib/content';
import { createWithBase } from '../../utils/format';
import { getThemeSettings } from '../../lib/theme-settings';

const base = import.meta.env.BASE_URL ?? '/';
const withBase = createWithBase(base);
const { settings } = getThemeSettings();

export async function buildArchiveFeed(context, overrides = {}) {
  const archiveItems = await getArchiveEssays({
    includeDraft: false,
  });

  return rss({
    title: overrides.title ?? `${settings.site.title} · 归档`,
    description: overrides.description ?? '归档更新',
    site: context.site,
    items: archiveItems.map((entry) => ({
      title: entry.data.title,
      pubDate: entry.data.date,
      description: entry.data.description,
      link: withBase(`/archive/${getEssaySlug(entry)}/`),
    })),
  });
}

export async function GET(context) {
  return buildArchiveFeed(context);
}
