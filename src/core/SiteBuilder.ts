import { ObsidianConfig } from '../types/Config';
import { BuildResult } from '../types/ParsedContent';
import { VaultReader } from './VaultReader';
import { MarkdownProcessor } from './MarkdownProcessor';
import { HTMLGenerator } from './HTMLGenerator';
import { ResourceCopier } from './ResourceCopier';
import { FileSystem } from '../utils/FileSystem';
import { logger } from '../utils/Logger';
import path from 'path';

export class SiteBuilder {
  private config: ObsidianConfig;

  constructor(config: ObsidianConfig) {
    this.config = config;
  }

  async build(): Promise<BuildResult> {
    logger.info(`Building site from ${this.config.source} to ${this.config.output}`);

    const deadLinks: string[] = [];
    const errors: string[] = [];

    try {
      const vaultReader = new VaultReader(this.config.source, this.config.exclude);
      const vaultStructure = await vaultReader.scan();

      if (vaultStructure.markdownFiles.length === 0) {
        throw new Error(
          `No markdown files found in ${this.config.source}. Please check the --source path.`
        );
      }

      logger.startSpinner('Processing markdown files...');

      const markdownProcessor = new MarkdownProcessor(
        this.config,
        vaultStructure.markdownFiles
      );

      const processedFiles = [];
      for (const file of vaultStructure.markdownFiles) {
        try {
          const processed = await markdownProcessor.process(file);
          processedFiles.push(processed);
        } catch (error) {
          logger.warn(`Failed to process ${file.path}: ${(error as Error).message}`);
          errors.push(`${file.path}: ${(error as Error).message}`);
        }
      }

      logger.succeedSpinner(`Processed ${processedFiles.length} markdown files`);

      logger.startSpinner('Generating HTML pages...');

      const htmlGenerator = new HTMLGenerator(this.config);
      await htmlGenerator.initialize();

      const linkMaps = htmlGenerator.buildLinkMaps(processedFiles);

      const generatedPages = [];
      for (const processed of processedFiles) {
        try {
          const linkData = linkMaps.get(processed.slug) || { outlinks: [], backlinks: [] };
          const page = htmlGenerator.generatePage(processed, linkData.outlinks, linkData.backlinks);
          await FileSystem.writeFile(page.outputPath, page.content);
          generatedPages.push(page);
        } catch (error) {
          logger.warn(`Failed to generate ${processed.outputPath}: ${(error as Error).message}`);
          errors.push(`${processed.outputPath}: ${(error as Error).message}`);
        }
      }

      logger.succeedSpinner(`Generated ${generatedPages.length} HTML pages`);

      if (this.config.features.generateIndex) {
        logger.info('Generating index page...');
        const indexPage = htmlGenerator.generateIndex(generatedPages, processedFiles);
        await FileSystem.writeFile(indexPage.outputPath, indexPage.content);
        logger.success('Index page generated');

        logger.info('Generating tag pages...');
        const tagPages = htmlGenerator.generateTagPages(generatedPages);
        for (const tagPage of tagPages) {
          await FileSystem.writeFile(tagPage.outputPath, tagPage.content);
        }
        logger.success(`Generated ${tagPages.length} tag pages`);
      }

      if (this.config.features.copyAssets) {
        const resourceCopier = new ResourceCopier(this.config.source, this.config.output);
        await resourceCopier.copyResources(vaultStructure.resources);
      }

      if (this.config.features.generateSitemap) {
        logger.info('Generating sitemap...');
        await this.generateSitemap(generatedPages);
        logger.success('Sitemap generated');
      }

      logger.success(`Build completed successfully!`);
      logger.info(`Output: ${this.config.output}`);

      return {
        pagesGenerated: generatedPages.length,
        resourcesCopied: vaultStructure.resources.length,
        deadLinks,
        errors,
      };
    } catch (error) {
      logger.error('Build failed', error as Error);
      throw error;
    }
  }

  private async generateSitemap(pages: { outputPath: string; frontmatter: { date?: string } }[]): Promise<void> {
    const baseUrl = this.config.site.url || '';

    const urls = pages.map(page => {
      const relativePath = path.relative(this.config.output, page.outputPath);
      const urlPath = relativePath.split(path.sep).join('/');
      const fullUrl = baseUrl ? `${baseUrl}/${urlPath}` : `/${urlPath}`;
      const lastmod = page.frontmatter.date || new Date().toISOString().split('T')[0];

      return `  <url>
    <loc>${fullUrl}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`;
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    const sitemapPath = path.join(this.config.output, 'sitemap.xml');
    await FileSystem.writeFile(sitemapPath, sitemap);
  }
}
