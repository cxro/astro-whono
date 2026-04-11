import {
  getLangIcon,
  getLangLabel,
  normalizeLang,
} from '../utils/lang-icons.mjs';

const isElement = (node, tag) =>
  node && node.type === 'element' && node.tagName === tag;

const getText = (node) => {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (Array.isArray(node.children)) {
    return node.children.map(getText).join('');
  }
  return '';
};

const getProp = (props, key) => {
  if (!props) return null;
  if (props[key] != null) return props[key];
  const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  if (props[camel] != null) return props[camel];
  return null;
};

const getLangFromPre = (pre) => {
  const props = pre?.properties || {};
  const dataLang =
    getProp(props, 'data-lang') || getProp(props, 'data-language');
  if (dataLang) return String(dataLang);

  const cls = props.className;
  const classes = Array.isArray(cls)
    ? cls
    : typeof cls === 'string'
      ? cls.split(/\s+/)
      : [];
  const match = classes.find((name) => name && name.startsWith('language-'));
  if (match) return match.replace(/^language-/, '');
  return '';
};

const hasLineClass = (node) => {
  const cls = node?.properties?.className;
  if (Array.isArray(cls)) return cls.includes('line');
  if (typeof cls === 'string') return cls.split(/\s+/).includes('line');
  return false;
};

const countLines = (pre) => {
  const code = Array.isArray(pre.children)
    ? pre.children.find((child) => isElement(child, 'code'))
    : null;
  if (!code) return 0;

  const lineNodes = Array.isArray(code.children)
    ? code.children.filter(
        (child) => child.type === 'element' && hasLineClass(child)
      )
    : [];
  if (lineNodes.length) return lineNodes.length;

  const text = getText(code).replace(/\r\n/g, '\n');
  if (!text) return 0;
  const parts = text.split('\n');
  if (parts.length > 1 && parts[parts.length - 1] === '') {
    return Math.max(1, parts.length - 1);
  }
  return Math.max(1, parts.length);
};

const createText = (value) => ({ type: 'text', value });

const createSvgElement = (properties, children = []) => ({
  type: 'element',
  tagName: 'svg',
  properties,
  children,
});

const createCopyIcon = () =>
  createSvgElement(
    {
      className: ['icon-copy'],
      width: 16,
      height: 16,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    [
      {
        type: 'element',
        tagName: 'rect',
        properties: { width: 14, height: 14, x: 8, y: 8, rx: 2, ry: 2 },
        children: [],
      },
      {
        type: 'element',
        tagName: 'path',
        properties: {
          d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2',
        },
        children: [],
      },
    ]
  );

const createCheckIcon = () =>
  createSvgElement(
    {
      className: ['icon-check'],
      viewBox: '0 0 24 24',
      'aria-hidden': 'true',
    },
    [
      {
        type: 'element',
        tagName: 'path',
        properties: {
          d: 'M5 13l4 4L19 7',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: '1.8',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        children: [],
      },
    ]
  );

const createToolbar = ({ langLabel, iconSvg, lineCount }) => {
  const lineText = lineCount === 1 ? '1 Line' : `${lineCount} Lines`;

  const langChildren = [];
  if (iconSvg) {
    langChildren.push({ type: 'raw', value: iconSvg });
  }
  langChildren.push({
    type: 'element',
    tagName: 'span',
    properties: {},
    children: [createText(langLabel)],
  });

  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['code-toolbar'] },
    children: [
      {
        type: 'element',
        tagName: 'span',
        properties: { className: ['code-lang'] },
        children: langChildren,
      },
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-meta'] },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['code-info'] },
            children: [createText('UTF-8')],
          },
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['code-separator'] },
            children: [createText('|')],
          },
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['code-info'] },
            children: [createText(lineText)],
          },
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['code-separator'] },
            children: [createText('|')],
          },
          {
            type: 'element',
            tagName: 'button',
            properties: {
              className: ['code-copy'],
              type: 'button',
              disabled: true,
              'aria-label': 'Copy Code',
              title: 'Copy Code',
              'data-state': 'idle',
            },
            children: [createCopyIcon(), createCheckIcon()],
          },
        ],
      },
    ],
  };
};

export default function shikiToolbar() {
  return {
    name: 'astro-whono-code-toolbar',
    pre(node) {
      const rawLang = getLangFromPre(node);
      const normalized = normalizeLang(rawLang);
      const lines = countLines(node);
      node.properties = {
        ...(node.properties || {}),
        'data-lang': normalized,
        'data-lines': String(lines || 0),
      };
    },
    root(node) {
      if (!Array.isArray(node.children)) return;
      const preIndex = node.children.findIndex((child) =>
        isElement(child, 'pre')
      );
      if (preIndex === -1) return;
      const pre = node.children[preIndex];

      const rawLang = getLangFromPre(pre);
      const normalized = normalizeLang(rawLang);
      const lineCount = Math.max(1, countLines(pre));
      const langLabel = getLangLabel(rawLang, normalized);
      const icon = getLangIcon(rawLang);
      const toolbar = createToolbar({
        langLabel,
        iconSvg: icon ? icon.svg : null,
        lineCount,
      });

      const wrapper = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['code-block'],
          'data-lang': normalized,
          'data-lines': String(lineCount),
        },
        children: [toolbar, pre],
      };

      node.children.splice(preIndex, 1, wrapper);
    },
  };
}
