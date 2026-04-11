import { visit } from 'unist-util-visit';

const CALLOUT_TYPES = new Set(['note', 'tip', 'info', 'warning']);

const getText = (node) => {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (Array.isArray(node.children)) {
    return node.children.map(getText).join('');
  }
  return '';
};

export default function remarkCallout() {
  return (tree) => {
    visit(tree, 'containerDirective', (node) => {
      const type = CALLOUT_TYPES.has(node.name) ? node.name : 'note';

      if (!node.data) node.data = {};
      node.data.hName = 'div';
      node.data.hProperties = {
        ...(node.data.hProperties || {}),
        className: ['callout', type],
      };

      if (!Array.isArray(node.children) || node.children.length === 0) return;

      const labelIndex = node.children.findIndex((child) => {
        return (
          child?.type === 'paragraph' && child?.data?.directiveLabel === true
        );
      });

      if (labelIndex === -1) return;

      const labelNode = node.children[labelIndex];
      const labelText = getText(labelNode).trim();
      if (!labelText) {
        node.children.splice(labelIndex, 1);
        return;
      }

      if (!labelNode.data) labelNode.data = {};
      labelNode.data.hName = 'p';
      labelNode.data.hProperties = {
        ...(labelNode.data.hProperties || {}),
        className: ['callout-title'],
      };
    });
  };
}
