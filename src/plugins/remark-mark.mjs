import { visit } from 'unist-util-visit';

// `==文本==` 渲染为 <mark>。在 mdast 文本节点上配对，而不是写 micromark 扩展：
// GFM 删除线式的 flanking 规则遇到中文标点会失败（`==重点。==后面` 无法闭合）。
const DELIMITER_RE = /(?<!=)==(?!=)/g;
const ASCII_WORD_RE = /[A-Za-z0-9]/;
const WHITESPACE_RE = /\s/;
// 粗体、行内代码、链接等非文本节点视作标点，可以紧贴 == 两侧。
const NODE_EDGE = '\u0000';

const splitText = (value) => {
  const tokens = [];
  let lastIndex = 0;
  for (const match of value.matchAll(DELIMITER_RE)) {
    if (match.index > lastIndex) tokens.push({ type: 'text', value: value.slice(lastIndex, match.index) });
    tokens.push({ type: 'delimiter' });
    lastIndex = match.index + 2;
  }
  if (lastIndex < value.length) tokens.push({ type: 'text', value: value.slice(lastIndex) });
  return tokens;
};

const edgeChar = (token, side) => {
  if (!token) return undefined;
  if (token.type === 'text') return side === 'start' ? token.value[0] : token.value.at(-1);
  return NODE_EDGE;
};

// `a==b` 这类夹在英文字母或数字之间的等号不算标记，避免误伤正文里的表达式。
const canOpen = (previous, next) =>
  next !== undefined && !WHITESPACE_RE.test(next) && !(previous && ASCII_WORD_RE.test(previous));

const canClose = (previous, next) =>
  previous !== undefined && !WHITESPACE_RE.test(previous) && !(next && ASCII_WORD_RE.test(next));

const toNodes = (tokens) =>
  tokens.reduce((nodes, token) => {
    const node = token.type === 'delimiter' ? { type: 'text', value: '==' } : token;
    const previous = nodes[nodes.length - 1];
    if (previous?.type === 'text' && node.type === 'text') {
      previous.value += node.value;
    } else {
      nodes.push(node);
    }
    return nodes;
  }, []);

const markChildren = (children) => {
  const tokens = children.flatMap((child) => (child.type === 'text' ? splitText(child.value) : [child]));
  const closeByOpen = new Map();
  let openIndex = -1;

  tokens.forEach((token, index) => {
    if (token.type !== 'delimiter') return;
    const previous = edgeChar(tokens[index - 1], 'end');
    const next = edgeChar(tokens[index + 1], 'start');
    if (openIndex !== -1 && canClose(previous, next)) {
      closeByOpen.set(openIndex, index);
      openIndex = -1;
      return;
    }
    if (canOpen(previous, next)) openIndex = index;
  });

  if (closeByOpen.size === 0) return null;

  const output = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const closeIndex = closeByOpen.get(index);
    if (closeIndex === undefined) {
      output.push(tokens[index]);
      continue;
    }
    output.push({
      type: 'mark',
      data: { hName: 'mark' },
      children: toNodes(tokens.slice(index + 1, closeIndex))
    });
    index = closeIndex;
  }
  return toNodes(output);
};

export default function remarkMark() {
  return (tree) => {
    visit(tree, (node) => {
      if (!Array.isArray(node.children)) return;
      if (!node.children.some((child) => child.type === 'text' && child.value.includes('=='))) return;
      const children = markChildren(node.children);
      if (children) node.children = children;
    });
  };
}
