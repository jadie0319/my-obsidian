import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, BlockContent } from 'mdast';

const calloutTypes: Record<string, string> = {
  note: 'blue',
  tip: 'green',
  important: 'purple',
  warning: 'yellow',
  caution: 'red',
  info: 'blue',
  success: 'green',
  question: 'orange',
  failure: 'red',
  danger: 'red',
  bug: 'red',
  example: 'purple',
  quote: 'gray',
};

export const remarkCallout: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'blockquote', (node, index, parent) => {
      if (!parent || index === undefined) return;

      const firstChild = node.children[0];
      if (firstChild?.type !== 'paragraph') return;

      const firstText = firstChild.children[0];
      if (firstText?.type !== 'text') return;

      const match = firstText.value.match(/^\[!(\w+)\]\s*/);
      if (!match) return;

      const calloutType = match[1].toLowerCase();
      const color = calloutTypes[calloutType] || 'blue';

      firstText.value = firstText.value.replace(match[0], '');
      if (firstText.value === '') {
        firstChild.children.shift();
      }

      const htmlNode: BlockContent = {
        type: 'html' as const,
        value: `<div class="callout callout-${calloutType}" style="border-left: 4px solid var(--callout-${color});">`,
      };

      const closingNode: BlockContent = {
        type: 'html' as const,
        value: '</div>',
      };

      parent.children.splice(index, 1, htmlNode, ...node.children, closingNode);
    });
  };
};
