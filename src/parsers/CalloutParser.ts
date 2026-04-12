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

      const match = firstText.value.match(/^\[!(\w+)\]([+-]?)\s*/);
      if (!match) return;

      const calloutType = match[1].toLowerCase();
      const modifier = match[2]; // '', '+', or '-'
      const color = calloutTypes[calloutType] || 'blue';
      const isCollapsible = modifier === '+' || modifier === '-';
      const isOpen = modifier === '+';

      // Title text: whatever remains on the first line after removing the marker
      firstText.value = firstText.value.replace(match[0], '');
      const titleText = firstText.value.trim();

      // Remove the first text node (or entire first paragraph) since we handle it as <summary>
      if (isCollapsible) {
        // Always remove the first paragraph — it becomes the <summary>
        node.children.shift();
      } else {
        if (firstText.value === '') {
          firstChild.children.shift();
        }
      }

      let htmlNode: BlockContent;
      let closingNode: BlockContent;

      if (isCollapsible) {
        const openAttr = isOpen ? ' open' : '';
        const displayTitle = titleText || calloutType.charAt(0).toUpperCase() + calloutType.slice(1);
        htmlNode = {
          type: 'html' as const,
          value: `<details class="callout callout-${calloutType}" style="border-left: 4px solid var(--callout-${color});"${openAttr}><summary class="callout-title">${displayTitle}</summary><div class="callout-body">`,
        };
        closingNode = {
          type: 'html' as const,
          value: '</div></details>',
        };
      } else {
        htmlNode = {
          type: 'html' as const,
          value: `<div class="callout callout-${calloutType}" style="border-left: 4px solid var(--callout-${color});">`,
        };
        closingNode = {
          type: 'html' as const,
          value: '</div>',
        };
      }

      parent.children.splice(index, 1, htmlNode, ...node.children, closingNode);
    });
  };
};
