import { defaultSchema } from 'rehype-sanitize';

const getSchemaAttrs = (tagName) => {
  const attrs = defaultSchema.attributes?.[tagName];
  return Array.isArray(attrs) ? attrs : [];
};

const mergeAttrs = (...lists) => Array.from(new Set(lists.flat()));

export const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'cite',
    'figure',
    'figcaption',
    'picture',
    'source',
    'summary',
    'details',
    'dialog',
    'button',
    'svg',
    'path',
    'rect'
  ],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    '*': [
      ...((defaultSchema.attributes?.['*'] ?? [])),
      'className',
      'class',
      'id',
      'title',
      'role',
      'style',
      'tabIndex',
      'tabindex',
      'aria-label',
      'aria-hidden',
      'aria-live',
      'aria-controls',
      'aria-haspopup',
      'aria-pressed',
      'data-icon',
      'data-lang',
      'data-lines',
      'data-state'
    ],
    a: mergeAttrs(getSchemaAttrs('a'), ['target', 'rel']),
    h2: mergeAttrs(getSchemaAttrs('h2'), ['dataAdminOutlineKey', 'data-admin-outline-key']),
    h3: mergeAttrs(getSchemaAttrs('h3'), ['dataAdminOutlineKey', 'data-admin-outline-key']),
    img: mergeAttrs(getSchemaAttrs('img'), ['loading', 'decoding', 'width', 'height']),
    source: mergeAttrs(getSchemaAttrs('source'), ['srcset', 'srcSet', 'type', 'media', 'sizes']),
    ul: [['className', 'gallery', 'cols-2', 'cols-3', 'contains-task-list']],
    figure: [['className', 'figure']],
    figcaption: [['className', 'figure-caption']],
    div: mergeAttrs(getSchemaAttrs('div'), ['dataIcon', 'dataLang', 'dataLines', 'data-icon', 'data-lang', 'data-lines']),
    p: mergeAttrs(getSchemaAttrs('p'), ['dataIcon', 'data-icon']),
    pre: mergeAttrs(getSchemaAttrs('pre'), ['dataLang', 'dataLines', 'data-lang', 'data-lines']),
    code: mergeAttrs(getSchemaAttrs('code'), ['dataLang', 'data-lang']),
    button: mergeAttrs(getSchemaAttrs('button'), [
      'type',
      'disabled',
      'title',
      'ariaLabel',
      'aria-label',
      'dataState',
      'data-state'
    ]),
    svg: [
      ...getSchemaAttrs('svg'),
      'viewBox',
      'width',
      'height',
      'fill',
      'stroke',
      'strokeWidth',
      'strokeLinecap',
      'strokeLinejoin',
      'ariaHidden'
    ],
    path: [
      ...getSchemaAttrs('path'),
      'd',
      'fill',
      'stroke',
      'strokeWidth',
      'strokeLinecap',
      'strokeLinejoin'
    ],
    rect: [...getSchemaAttrs('rect'), 'x', 'y', 'rx', 'ry', 'width', 'height']
  }
};
