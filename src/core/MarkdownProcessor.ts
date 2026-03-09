import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeHighlight from 'rehype-highlight';
import { VaultFile } from '../types/VaultFile';
import { ProcessedFile } from '../types/ParsedContent';
import { FrontMatterParser } from '../parsers/FrontMatterParser';
import { WikiLinkResolver } from '../parsers/WikiLinkParser';
import { remarkCallout } from '../parsers/CalloutParser';
import { PathResolver } from '../utils/PathResolver';
import { ObsidianConfig } from '../types/Config';
import path from 'path';
import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root } from 'mdast';

export class MarkdownProcessor {
  private config: ObsidianConfig;
  private wikiLinkResolver: WikiLinkResolver;

  constructor(config: ObsidianConfig, vaultFiles: VaultFile[]) {
    this.config = config;
    this.wikiLinkResolver = new WikiLinkResolver(
      vaultFiles,
      config.output,
      config.source
    );
  }

  async process(file: VaultFile): Promise<ProcessedFile> {
    const { frontmatter, content: markdownContent } = FrontMatterParser.parse(file.content);

    const title = FrontMatterParser.extractTitle(frontmatter, markdownContent, file.basename);
    const slug = PathResolver.slugify(file.basename);
    const outputPath = PathResolver.toOutputPath(
      file.absolutePath,
      this.config.source,
      this.config.output
    );

    const links: string[] = [];
    const embeds: string[] = [];

    const remarkWikiLinkPlugin = this.createWikiLinkPlugin(links);
    const remarkEmbedPlugin = this.createEmbedPlugin(embeds);

    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkFrontmatter, ['yaml'])
      .use(remarkWikiLinkPlugin)
      .use(remarkEmbedPlugin)
      .use(remarkCallout)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeHighlight)
      .use(rehypeStringify, { allowDangerousHtml: true });

    const vfile = await processor.process(markdownContent);
    const html = String(vfile);

    return {
      html,
      frontmatter,
      links,
      embeds,
      title,
      slug,
      outputPath,
      sourcePath: file.path,
    };
  }

  private createWikiLinkPlugin(links: string[]): Plugin<[], Root> {
    const resolver = this.wikiLinkResolver;

    return () => {
      return (tree) => {
        visit(tree, 'text', (node, index, parent) => {
          if (!parent || index === undefined) return;

          const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
          let match;
          const newNodes = [];
          let lastIndex = 0;

          while ((match = wikiLinkRegex.exec(node.value)) !== null) {
            const fullMatch = match[0];
            const linkText = match[1];

            if (match.index > lastIndex) {
              newNodes.push({
                type: 'text' as const,
                value: node.value.slice(lastIndex, match.index),
              });
            }

            const { url, alias } = resolver.resolve(fullMatch);

            if (url) {
              links.push(linkText);
              newNodes.push({
                type: 'link' as const,
                url,
                children: [{ type: 'text' as const, value: alias || linkText.split('|')[0] }],
              });
            } else {
              newNodes.push({
                type: 'text' as const,
                value: alias || linkText.split('|')[0],
              });
            }

            lastIndex = match.index + fullMatch.length;
          }

          if (lastIndex < node.value.length) {
            newNodes.push({
              type: 'text' as const,
              value: node.value.slice(lastIndex),
            });
          }

          if (newNodes.length > 0) {
            parent.children.splice(index, 1, ...newNodes);
          }
        });
      };
    };
  }

  private createEmbedPlugin(embeds: string[]): Plugin<[], Root> {
    return () => {
      return (tree) => {
        visit(tree, 'text', (node, index, parent) => {
          if (!parent || index === undefined) return;

          const embedRegex = /!\[\[([^\]]+)\]\]/g;
          let match;
          const newNodes = [];
          let lastIndex = 0;

          while ((match = embedRegex.exec(node.value)) !== null) {
            const fullMatch = match[0];
            const embedText = match[1];

            if (match.index > lastIndex) {
              newNodes.push({
                type: 'text' as const,
                value: node.value.slice(lastIndex, match.index),
              });
            }

            const imagePath = `${this.config.basePath}assets/images/${PathResolver.slugify(path.parse(embedText).name)}${path.extname(embedText)}`;
            embeds.push(embedText);

            newNodes.push({
              type: 'image' as const,
              url: imagePath,
              alt: embedText,
            });

            lastIndex = match.index + fullMatch.length;
          }

          if (lastIndex < node.value.length) {
            newNodes.push({
              type: 'text' as const,
              value: node.value.slice(lastIndex),
            });
          }

          if (newNodes.length > 0) {
            parent.children.splice(index, 1, ...newNodes);
          }
        });
      };
    };
  }
}
