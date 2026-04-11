/**
 * Cloudflare R2 Image Utilities
 *
 * Helper functions for working with images stored in Cloudflare R2.
 * These utilities help with URL building, dimension fetching, and optimization.
 */

import { createWithBase } from './format';

const base = import.meta.env.BASE_URL ?? '/';
const withBase = createWithBase(base);

// R2 bucket base URL
export const R2_BASE_URL =
  'https://f3269be535874c84e13e71f0d70c37dd.r2.cloudflarestorage.com/shuhanluo-gallery';

/**
 * Builds a full R2 URL from a relative path
 * @param path - Relative path (e.g., 'photo.webp', '2026/04/photo.webp')
 * @returns Full R2 URL
 */
export function buildR2Url(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.replace(/^\/+/, '');
  return `${R2_BASE_URL}/${cleanPath}`;
}

/**
 * Extracts dimensions from an image URL if they are encoded in the filename
 * Pattern: image-1200x800.webp or image_1200_800.webp
 * @param url - Image URL
 * @returns Object with width and height, or null if not found
 */
export function extractDimensionsFromUrl(
  url: string
): { width: number; height: number } | null {
  const match = url.match(/[-_](\d+)[x_-](\d+)\.[a-z]+$/i);
  if (match) {
    return {
      width: parseInt(match[1]!, 10),
      height: parseInt(match[2]!, 10),
    };
  }
  return null;
}

/**
 * Checks if a URL is an R2 URL
 * @param url - URL to check
 * @returns True if it's an R2 URL
 */
export function isR2Url(url: string): boolean {
  return url.includes('r2.cloudflarestorage.com');
}

/**
 * Normalizes an image source for use in the site
 * - R2 URLs are returned as-is
 * - Local paths are resolved with base URL
 * - Absolute URLs are returned as-is
 * @param src - Image source (URL or path)
 * @returns Normalized source URL
 */
export function normalizeImageSrc(src: string): string {
  // If it's already a full URL, return as-is
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }

  // If it's an R2 path, build the full URL
  if (!src.startsWith('/')) {
    return buildR2Url(src);
  }

  // Otherwise, treat as local path with base
  return withBase(src.replace(/^\/+/, ''));
}

/**
 * Validates image dimensions
 * @param width - Width in pixels
 * @param height - Height in pixels
 * @returns True if dimensions are valid
 */
export function validateDimensions(width: number, height: number): boolean {
  return (
    Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
  );
}

/**
 * Image metadata interface for frontmatter
 */
export interface ImageMetadata {
  src: string;
  width: number;
  height: number;
  alt?: string;
}

/**
 * Validates image metadata object
 * @param image - Image metadata object
 * @returns True if valid
 */
export function validateImageMetadata(
  image: Partial<ImageMetadata>
): image is ImageMetadata {
  return !!(
    image.src &&
    typeof image.width === 'number' &&
    typeof image.height === 'number' &&
    validateDimensions(image.width, image.height)
  );
}
