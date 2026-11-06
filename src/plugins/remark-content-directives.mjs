import { visit } from 'unist-util-visit';

// remark-directive 会把 `10:30`、`a:b`、`localhost:4321` 解析成 textDirective，文字被吞掉、段落被拆开。
// 正文里没有注册过的行内指令，一律按源文本原样还原。
const restoreUnknownTextDirectives = (tree, source) => {
  const touchedParents = new Set();

  visit(tree, 'textDirective', (node, index, parent) => {
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (!parent || typeof index !== 'number' || typeof start !== 'number' || typeof end !== 'number') return;

    parent.children[index] = { type: 'text', value: source.slice(start, end) };
    touchedParents.add(parent);
  });

  touchedParents.forEach((parent) => {
    parent.children = parent.children.reduce((merged, child) => {
      const previous = merged[merged.length - 1];
      if (previous?.type === 'text' && child.type === 'text') {
        previous.value += child.value;
      } else {
        merged.push(child);
      }
      return merged;
    }, []);
  });
};

export default function remarkContentDirectives() {
  return (tree, file) => {
    restoreUnknownTextDirectives(tree, String(file.value));
  };
}
