import { visit } from 'unist-util-visit';

// 只防剧透：原文仍在 HTML 中，点击由 src/scripts/spoiler.ts 处理。
const SPOILER_PROPERTIES = Object.freeze({
  role: 'button',
  tabIndex: 0,
  ariaLabel: '隐藏内容，点击显示',
  title: '点击显示'
});
const DETAILS_DEFAULT_SUMMARY = '详情';

// remark-directive 会把 `10:30`、`a:b`、`localhost:4321` 解析成 textDirective，文字被吞掉、段落被拆开。
// 除 `:spoiler[...]` 外，行内指令一律按源文本原样还原。
const transformTextDirectives = (tree, source) => {
  visit(tree, 'textDirective', (node, index, parent) => {
    if (node.name === 'spoiler' && node.children.length > 0) {
      node.data = {
        hName: 'span',
        hProperties: { className: ['spoiler'], ...SPOILER_PROPERTIES }
      };
      return;
    }

    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (!parent || typeof index !== 'number' || typeof start !== 'number' || typeof end !== 'number') return;

    parent.children[index] = { type: 'text', value: source.slice(start, end) };
  });
};

const transformDetails = (node) => {
  node.data = {
    hName: 'details',
    hProperties: Object.hasOwn(node.attributes ?? {}, 'open') ? { open: true } : {}
  };

  const label = node.children[0];
  if (label?.type === 'paragraph' && label.data?.directiveLabel === true) {
    label.data.hName = 'summary';
    return;
  }

  node.children.unshift({
    type: 'paragraph',
    data: { hName: 'summary' },
    children: [{ type: 'text', value: DETAILS_DEFAULT_SUMMARY }]
  });
};

export default function remarkContentDirectives() {
  return (tree, file) => {
    transformTextDirectives(tree, String(file.value));

    visit(tree, 'containerDirective', (node) => {
      if (node.name === 'details') {
        transformDetails(node);
        return;
      }
      if (node.name === 'spoiler') {
        node.data = {
          hName: 'div',
          hProperties: { className: ['spoiler', 'spoiler--block'], ...SPOILER_PROPERTIES }
        };
      }
    });
  };
}
