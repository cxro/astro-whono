import { visit } from 'unist-util-visit';

// Astro leaves root-relative image paths (`/images/a.webp`) untouched in Markdown and raw HTML,
// so they miss the deployment base on subpath deploys. Paths already under the base are kept.
export const rehypeImageBasePath = (options = {}) => {
  const base = typeof options.base === 'string' && options.base.trim() ? options.base.trim() : '/';
  const baseNormalized = base.endsWith('/') ? base : `${base}/`;
  if (baseNormalized === '/') return () => {};

  const withBase = (url) => {
    if (!url.startsWith('/') || url.startsWith('//')) return url;
    if (url.startsWith(baseNormalized) || url === baseNormalized.slice(0, -1)) return url;
    return `${baseNormalized}${url.slice(1)}`;
  };

  // srcset is a plain string of comma-separated candidates: "url [descriptor]".
  const withBaseSrcSet = (value) =>
    String(value)
      .split(',')
      .map((candidate) => candidate.trim())
      .filter(Boolean)
      .map((candidate) => {
        const [url, ...descriptors] = candidate.split(/\s+/);
        return [withBase(url), ...descriptors].join(' ');
      })
      .join(', ');

  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'img' && node.tagName !== 'source') return;
      const properties = node.properties ?? {};

      if (node.tagName === 'img' && typeof properties.src === 'string') {
        properties.src = withBase(properties.src);
      }
      if (properties.srcSet != null) {
        properties.srcSet = withBaseSrcSet(properties.srcSet);
      }
    });
  };
};
