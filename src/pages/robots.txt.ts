import type { APIRoute } from 'astro';
import { hasSiteUrl, siteUrl } from '../../site.config.mjs';

export const GET: APIRoute = () => {
  const lines = ['User-agent: *', 'Allow: /'];

  if (hasSiteUrl) {
    const sitemap = new URL('sitemap-index.xml', `${siteUrl}/`).href;
    lines.push(`Sitemap: ${sitemap}`);
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
