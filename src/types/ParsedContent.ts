export interface FrontMatter {
  title?: string;
  date?: string;
  tags?: string[];
  description?: string;
  [key: string]: unknown;
}

export interface ProcessedFile {
  html: string;
  frontmatter: FrontMatter;
  links: string[];
  embeds: string[];
  title: string;
  slug: string;
  outputPath: string;
  sourcePath: string;
}

export interface GeneratedPage {
  outputPath: string;
  content: string;
  title: string;
  frontmatter: FrontMatter;
}

export interface BuildResult {
  pagesGenerated: number;
  resourcesCopied: number;
  deadLinks: string[];
  errors: string[];
}
