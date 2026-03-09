import matter from 'gray-matter';
import { FrontMatter } from '../types/ParsedContent';

export class FrontMatterParser {
  static parse(content: string): { frontmatter: FrontMatter; content: string } {
    try {
      const { data, content: markdownContent } = matter(content);

      const frontmatter: FrontMatter = {
        title: data.title as string | undefined,
        date: data.date as string | undefined,
        tags: Array.isArray(data.tags) ? data.tags : [],
        description: data.description as string | undefined,
        ...data,
      };

      return {
        frontmatter,
        content: markdownContent,
      };
    } catch (error) {
      return {
        frontmatter: {},
        content,
      };
    }
  }

  static extractTitle(frontmatter: FrontMatter, content: string, basename: string): string {
    if (frontmatter.title) {
      return frontmatter.title;
    }

    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      return h1Match[1].trim();
    }

    return basename;
  }
}
