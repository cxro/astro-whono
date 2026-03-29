import rss from "@astrojs/rss";
import { getEssaySlug, getVisibleEssays } from "../../lib/content";
import { createWithBase } from "../../utils/format";
import { getThemeSettings } from "../../lib/theme-settings";

const base = import.meta.env.BASE_URL ?? "/";
const withBase = createWithBase(base);
const { settings } = getThemeSettings();

export async function GET(context) {
  const visibleEssays = await getVisibleEssays({
    includeDraft: false,
  });

  return rss({
    title: `${settings.site.title} · Essays`,
    description: "Essays and Notes Updates",
    site: context.site,
    items: visibleEssays.map((entry) => ({
      title: entry.data.title,
      pubDate: entry.data.date,
      description: entry.data.description,
      link: withBase(`/archive/${getEssaySlug(entry)}/`),
    })),
  });
}
