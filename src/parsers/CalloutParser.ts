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

      // Remove the marker from the text node
      firstText.value = firstText.value.replace(match[0], '');

      let titleText = '';

      if (isCollapsible) {
        // Split on the first newline: text before = title, text after = body
        const newlineIdx = firstText.value.indexOf('\n');
        if (newlineIdx !== -1) {
          titleText = firstText.value.slice(0, newlineIdx).trim();
          // Keep the remainder as body content in the first paragraph
          firstText.value = firstText.value.slice(newlineIdx + 1);
          if (firstText.value === '') {
            firstChild.children.shift();
          }
        } else {
          // Entire first paragraph is just the title line — remove it
          titleText = firstText.value.trim();
          node.children.shift();
        }
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
