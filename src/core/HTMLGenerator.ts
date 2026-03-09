import { ProcessedFile, GeneratedPage } from '../types/ParsedContent';
import { ObsidianConfig } from '../types/Config';
import { TemplateEngine } from '../templates/TemplateEngine';
import { registerHelpers } from '../templates/helpers';
import { GraphDataGenerator } from './GraphDataGenerator';
import path from 'path';

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

  generatePage(processedFile: ProcessedFile): GeneratedPage {
    const html = this.templateEngine.render('page', {
      title: processedFile.title,
      siteTitle: this.config.site.title,
      description: processedFile.frontmatter.description,
      date: processedFile.frontmatter.date,
      tags: processedFile.frontmatter.tags,
      content: processedFile.html,
      basePath: this.config.basePath,
    });

    return {
      outputPath: processedFile.outputPath,
      content: html,
      title: processedFile.title,
      frontmatter: processedFile.frontmatter,
    };
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
