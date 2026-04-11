/**
 * Site Configuration
 *
 * This file contains the core site configuration. Edit these values to customize
 * your personal website.
 *
 * NOTE: Many settings can also be managed via the Theme Console at /admin
 * when running in development mode (npm run dev).
 */

// Site URL handling - checks for SITE_URL environment variable
// Used for RSS feeds, canonical URLs, sitemap generation, and Open Graph tags
const rawSiteUrl = (process.env.SITE_URL ?? '').trim();
const siteUrl = rawSiteUrl ? rawSiteUrl.replace(/\/+$/, '') : '';
const hasSiteUrl = siteUrl.length > 0;
const fallbackSiteUrl = 'https://example.invalid';

// Warning if SITE_URL is not set in production
if (!hasSiteUrl && process.env.NODE_ENV === 'production') {
  console.warn(
    '[astro-whono] SITE_URL is not set. RSS will use example.invalid; canonical/og will be omitted; sitemap will not be generated and robots will not include Sitemap.'
  );
}

/**
 * Core site metadata
 * Edit these to personalize your site
 */
export const site = {
  // Full URL for RSS and SEO
  url: hasSiteUrl ? siteUrl : fallbackSiteUrl,

  // Site title (appears in browser tab, RSS, sharing)
  title: 'Astro Themes by Whono',

  // Short brand name (appears in sidebar)
  brandTitle: 'Whono',

  // Default author name
  author: 'Whono',

  // Default author avatar path (relative to public/)
  authorAvatar: 'author/avatar.webp',

  // Site description for SEO and social sharing
  description:
    'A minimal Astro theme for writing: lightweight, maintainable, reusable.',
};

/**
 * Pagination settings
 * Number of items per page for each content type
 */
export const PAGE_SIZE_ARCHIVE = 12; // Items per archive page
export const PAGE_SIZE_ESSAY = 12; // Essays per page
export const PAGE_SIZE_BITS = 20; // Bits per page

// Export URL info for use in other modules
export { hasSiteUrl, siteUrl };
