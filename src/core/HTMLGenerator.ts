import { ProcessedFile, GeneratedPage } from '../types/ParsedContent';
import { ObsidianConfig } from '../types/Config';
import { TemplateEngine } from '../templates/TemplateEngine';
import { registerHelpers } from '../templates/helpers';
import { GraphDataGenerator } from './GraphDataGenerator';
import path from 'path';

export interface PageRef {
  title: string;
  url: string;
}

export class HTMLGenerator {
  private config: ObsidianConfig;
  private templateEngine: TemplateEngine;

  constructor(config: ObsidianConfig) {
    this.config = config;
    this.templateEngine = new TemplateEngine();
    registerHelpers();
  }

  async initialize(): Promise<void> {
    const templateDir = path.join(__dirname, '../../templates', this.config.template);
    await this.templateEngine.loadDefaultTemplates(templateDir);
  }

  buildLinkMaps(processedFiles: ProcessedFile[]): Map<string, { outlinks: PageRef[]; backlinks: PageRef[] }> {
    type PageInfo = { title: string; url: string; slug: string };
    const nameToPage = new Map<string, PageInfo>();

    for (const file of processedFiles) {
      const relativePath = path.relative(this.config.output, file.outputPath);
      const url = this.config.basePath + relativePath.split(path.sep).join('/');
      const basename = path.basename(file.sourcePath, '.md');
      const pageInfo: PageInfo = { title: file.title, url, slug: file.slug };

      nameToPage.set(basename, pageInfo);
      nameToPage.set(basename.toLowerCase(), pageInfo);
      nameToPage.set(file.slug, pageInfo);
      const pathWithoutExt = file.sourcePath.replace(/\.md$/, '');
      nameToPage.set(pathWithoutExt, pageInfo);
      nameToPage.set(pathWithoutExt.toLowerCase(), pageInfo);
    }

    const result = new Map<string, { outlinks: PageRef[]; backlinks: PageRef[] }>();
    for (const file of processedFiles) {
      result.set(file.slug, { outlinks: [], backlinks: [] });
    }

    for (const file of processedFiles) {
      const relativePath = path.relative(this.config.output, file.outputPath);
      const fileUrl = this.config.basePath + relativePath.split(path.sep).join('/');
      const fileRef: PageRef = { title: file.title, url: fileUrl };
      const seenTargets = new Set<string>();

      for (const linkText of file.links) {
        let target = nameToPage.get(linkText) || nameToPage.get(linkText.toLowerCase());
        if (!target) {
          const lowerLink = linkText.toLowerCase();
          for (const [key, value] of nameToPage) {
            if (key.toLowerCase().endsWith(lowerLink)) {
              target = value;
              break;
            }
          }
        }
        if (target && !seenTargets.has(target.slug)) {
          seenTargets.add(target.slug);
          result.get(file.slug)!.outlinks.push({ title: target.title, url: target.url });
          result.get(target.slug)!.backlinks.push(fileRef);
        }
      }
    }

    return result;
  }

  generatePage(processedFile: ProcessedFile, outlinks: PageRef[] = [], backlinks: PageRef[] = []): GeneratedPage {
    const allowedKeys = new Set(['created', 'modified']);
    const properties = Object.entries(processedFile.frontmatter)
      .filter(([key]) => allowedKeys.has(key))
      .map(([key, value]) => ({
        key,
        value: Array.isArray(value) ? value.join(', ') : String(value),
      }));

    const html = this.templateEngine.render('page', {
      title: processedFile.title,
      siteTitle: this.config.site.title,
      description: processedFile.frontmatter.description,
      date: processedFile.frontmatter.date,
      tags: processedFile.frontmatter.tags,
      content: processedFile.html,
      basePath: this.config.basePath,
      properties,
      outlinks,
      backlinks,
    });

    return {
      outputPath: processedFile.outputPath,
      content: html,
      title: processedFile.title,
      frontmatter: processedFile.frontmatter,
    };
  }

  generateTagPages(pages: GeneratedPage[]): GeneratedPage[] {
    const tagMap = new Map<string, { title: string; url: string; date: string }[]>();

    for (const page of pages) {
      const tags = (page.frontmatter.tags as string[] | undefined) || [];
      const relativePath = path.relative(this.config.output, page.outputPath);
      const url = this.config.basePath + relativePath.split(path.sep).join('/');

      for (const tag of tags) {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, []);
        }
        tagMap.get(tag)!.push({
          title: page.title,
          url,
          date: String(page.frontmatter.date || ''),
        });
      }
    }

    const tagPages: GeneratedPage[] = [];

    for (const [tag, taggedPages] of tagMap) {
      const sortedPages = [...taggedPages].sort((a, b) => b.date.localeCompare(a.date));

      const html = this.templateEngine.render('tag', {
        siteTitle: this.config.site.title,
        tag,
        pages: sortedPages,
        basePath: this.config.basePath,
        pageCount: sortedPages.length,
      });

      const tagParts = tag.split('/');
      const tagOutputPath = path.join(this.config.output, 'tags', ...tagParts, 'index.html');

      tagPages.push({
        outputPath: tagOutputPath,
        content: html,
        title: `Tag: ${tag}`,
        frontmatter: {},
      });
    }

    return tagPages;
  }

  generateIndex(pages: GeneratedPage[], processedFiles: ProcessedFile[]): GeneratedPage {
    const sortedPages = [...pages].sort((a, b) => {
      const dateA = String(a.frontmatter.date || '');
      const dateB = String(b.frontmatter.date || '');
      return dateB.localeCompare(dateA);
    });

    const pageList = sortedPages.map(page => {
      const relativePath = path.relative(this.config.output, page.outputPath);
      const url = this.config.basePath + relativePath.split(path.sep).join('/');

      return {
        title: page.title,
        url,
        description: page.frontmatter.description,
        date: page.frontmatter.date,
      };
    });

    const graphGenerator = new GraphDataGenerator(this.config);
    const graphData = graphGenerator.generate(processedFiles);

    const html = this.templateEngine.render('index', {
      siteTitle: this.config.site.title,
      description: this.config.site.description,
      pages: pageList,
      basePath: this.config.basePath,
      graphData: JSON.stringify(graphData),
    });

    return {
      outputPath: path.join(this.config.output, 'index.html'),
      content: html,
      title: this.config.site.title,
      frontmatter: {},
    };
  }
}
