import { visit } from 'unist-util-visit';

// Astro only collects local images from Markdown image syntax. Raw HTML <img> (e.g. admin
// gallery blocks) must join the same list so Astro's rehype-images step bundles them.
// The local-path rule mirrors @astrojs/markdown-remark remarkCollectImages.
const isLocalImagePath = (src) => !URL.canParse(src) && !src.startsWith('/');

const decodeImageSrc = (src) => {
  try {
    return decodeURI(src);
  } catch {
    return null;
  }
};

export const rehypeRawHtmlLocalImages = () => (tree, file) => {
  if (typeof file.path !== 'string') return;

  const localImagePaths = new Set(file.data.astro?.localImagePaths ?? []);
  const sizeBefore = localImagePaths.size;

  visit(tree, 'element', (node) => {
    if (node.tagName !== 'img') return;
    const src = node.properties?.src;
    if (typeof src !== 'string' || !src) return;

    const decoded = decodeImageSrc(src);
    if (decoded && isLocalImagePath(decoded)) localImagePaths.add(decoded);
  });

  if (localImagePaths.size === sizeBefore) return;
  file.data.astro ??= {};
  file.data.astro.localImagePaths = Array.from(localImagePaths);
};
