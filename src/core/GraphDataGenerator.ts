import { ProcessedFile } from '../types/ParsedContent';
import { GraphData, GraphNode, GraphEdge } from '../types/GraphData';
import { ObsidianConfig } from '../types/Config';
import { PathResolver } from '../utils/PathResolver';
import path from 'path';

const TAG_COLOR_PALETTE = [
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // yellow
  '#ef4444', // red
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#a855f7', // violet
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#eab308', // amber
];

export class GraphDataGenerator {
  private config: ObsidianConfig;

  constructor(config: ObsidianConfig) {
    this.config = config;
  }

  generate(processedFiles: ProcessedFile[]): GraphData {
    const slugMap = this.buildSlugMap(processedFiles);
    const nodes = this.createNodes(processedFiles);
    const edges = this.createEdges(processedFiles, slugMap);

    this.calculateNodeSizes(nodes, edges);
    this.markOrphanNodes(nodes, edges);

    const tagColors = this.generateTagColors(nodes);

    return {
      nodes,
      edges,
      tagColors,
    };
  }

  private buildSlugMap(files: ProcessedFile[]): Map<string, string> {
    const map = new Map<string, string>();

    for (const file of files) {
      const basename = path.basename(file.sourcePath, '.md');
      const slug = file.slug;

      map.set(basename, slug);
      map.set(basename.toLowerCase(), slug);

      const pathWithoutExt = file.sourcePath.replace(/\.md$/, '');
      map.set(pathWithoutExt, slug);
      map.set(pathWithoutExt.toLowerCase(), slug);
    }

    return map;
  }

  private createNodes(files: ProcessedFile[]): GraphNode[] {
    return files.map(file => {
      const relativePath = path.relative(this.config.output, file.outputPath);
      const url = '/' + relativePath.split(path.sep).join('/');

      const tags = file.frontmatter.tags || [];
      const group = tags.length > 0 ? tags[0] : 'untagged';

      return {
        id: file.slug,
        title: file.title,
        url,
        tags,
        group,
        size: 5,
        isOrphan: false,
      };
    });
  }

  private createEdges(
    files: ProcessedFile[],
    slugMap: Map<string, string>
  ): GraphEdge[] {
    const edges: GraphEdge[] = [];

    for (const file of files) {
      for (const linkText of file.links) {
        const targetSlug = this.resolveLink(linkText, slugMap);

        if (targetSlug) {
          edges.push({
            source: file.slug,
            target: targetSlug,
            type: 'link',
          });
        }
      }

      for (const embedText of file.embeds) {
        const targetSlug = this.resolveLink(embedText, slugMap);

        if (targetSlug) {
          edges.push({
            source: file.slug,
            target: targetSlug,
            type: 'embed',
          });
        }
      }
    }

    return edges;
  }

  private resolveLink(linkText: string, slugMap: Map<string, string>): string | null {
    const clean = linkText.split('|')[0].trim();

    if (slugMap.has(clean)) {
      return slugMap.get(clean)!;
    }

    const lowerClean = clean.toLowerCase();
    if (slugMap.has(lowerClean)) {
      return slugMap.get(lowerClean)!;
    }

    for (const [key, value] of slugMap) {
      if (key.toLowerCase().endsWith(lowerClean)) {
        return value;
      }
    }

    return null;
  }

  private calculateNodeSizes(nodes: GraphNode[], edges: GraphEdge[]): void {
    const linkCounts = new Map<string, number>();

    for (const node of nodes) {
      linkCounts.set(node.id, 0);
    }

    for (const edge of edges) {
      const sourceCount = linkCounts.get(edge.source) || 0;
      linkCounts.set(edge.source, sourceCount + 1);

      const targetCount = linkCounts.get(edge.target) || 0;
      linkCounts.set(edge.target, targetCount + 1);
    }

    for (const node of nodes) {
      const totalLinks = linkCounts.get(node.id) || 0;
      node.size = Math.sqrt(totalLinks) * 5 + 5;
      node.size = Math.min(node.size, 30);
    }
  }

  private markOrphanNodes(nodes: GraphNode[], edges: GraphEdge[]): void {
    const connectedNodes = new Set<string>();

    for (const edge of edges) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }

    for (const node of nodes) {
      node.isOrphan = !connectedNodes.has(node.id);
    }
  }

  private generateTagColors(nodes: GraphNode[]): Record<string, string> {
    const uniqueTags = new Set<string>();

    for (const node of nodes) {
      uniqueTags.add(node.group);
    }

    const tagColors: Record<string, string> = {};
    const tags = Array.from(uniqueTags).sort();

    tags.forEach((tag, index) => {
      if (tag === 'untagged') {
        tagColors[tag] = '#6b7280';
      } else {
        tagColors[tag] = TAG_COLOR_PALETTE[index % TAG_COLOR_PALETTE.length];
      }
    });

    return tagColors;
  }
}
