import type { APIRoute } from 'astro';
import { getBitsSearchIndex } from '../../lib/bits';
import { PAGE_SIZE_BITS } from '../../../site.config.mjs';

export const prerender = true;

export const GET: APIRoute = async () => {
  const index = await getBitsSearchIndex(PAGE_SIZE_BITS);
  const cacheControl = import.meta.env.DEV
    ? 'no-store'
    : 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  });
};
