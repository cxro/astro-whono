import { getThemeSettings } from '../lib/theme-settings';
import { buildArchiveFeed } from './archive/rss.xml.js';

const { settings } = getThemeSettings();

export async function GET(context) {
  return buildArchiveFeed(context, {
    title: settings.site.title,
    description: settings.site.description,
  });
}
