import { ObsidianConfig } from '../types/Config';
import { BuildResult } from '../types/ParsedContent';
import { VaultReader } from './VaultReader';
import { MarkdownProcessor } from './MarkdownProcessor';
import { HTMLGenerator } from './HTMLGenerator';
import { ResourceCopier } from './ResourceCopier';
import { FileSystem } from '../utils/FileSystem';
import { logger } from '../utils/Logger';
import path from 'path';
import { Publishing, escape } from './Publishing';
import { FrontMatterParser } from '../parsers/FrontMatterParser';
import { WikiLinkResolver } from '../parsers/WikiLinkParser';
import { PathResolver } from '../utils/PathResolver';
import { checkLinks } from './LinkChecker';
import { planRoutes, redirectPaths } from './PageRoutes';

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
      const publicFiles = vaultStructure.markdownFiles.filter(file => {
        const { frontmatter } = FrontMatterParser.parse(file.content);
        return frontmatter.draft !== true && frontmatter.published !== false && frontmatter.status !== 'draft';
      });

      if (vaultStructure.markdownFiles.length === 0) {
        throw new Error(
          `No markdown files found in ${this.config.source}. Please check the --source path.`
        );
      }

      logger.startSpinner('Processing markdown files...');

      const markdownProcessor = new MarkdownProcessor(
        this.config,
        publicFiles
      );

      const processedFiles = [];
      for (const file of publicFiles) {
        try {
          const processed = await markdownProcessor.process(file);
          processedFiles.push(processed);
        } catch (error) {
          logger.warn(`Failed to process ${file.path}: ${(error as Error).message}`);
          errors.push(`${file.path}: ${(error as Error).message}`);
        }
      }

      logger.succeedSpinner(`Processed ${processedFiles.length} markdown files`);
      if (errors.length) throw new Error(`Failed to process ${errors.length} notes: ${errors.join('; ')}`);

      logger.startSpinner('Generating HTML pages...');

      const htmlGenerator = new HTMLGenerator(this.config);
      await htmlGenerator.initialize();
      const publishing = new Publishing(this.config, processedFiles);
      const allPages: import('../types/ParsedContent').GeneratedPage[] = [];
      const redirects = planRoutes(processedFiles, this.config);

      const linkMaps = htmlGenerator.buildLinkMaps(processedFiles);

      const generatedPages = [];
      for (const processed of processedFiles) {
        try {
          const linkData = linkMaps.get(processed.slug) || { outlinks: [], backlinks: [] };
          const page = publishing.enhance(htmlGenerator.generatePage(processed, linkData.outlinks, linkData.backlinks));
          await FileSystem.writeFile(page.outputPath, page.content);
          generatedPages.push(page);
          allPages.push(page);
        } catch (error) {
          logger.warn(`Failed to generate ${processed.outputPath}: ${(error as Error).message}`);
          errors.push(`${processed.outputPath}: ${(error as Error).message}`);
        }
      }

      logger.succeedSpinner(`Generated ${generatedPages.length} HTML pages`);
      if (errors.length) throw new Error(`Failed to generate ${errors.length} pages: ${errors.join('; ')}`);
      for (const redirect of redirects) {
        await FileSystem.writeFile(redirect.outputPath, redirect.content);
        allPages.push(redirect);
      }

      if (this.config.features.generateIndex) {
        logger.info('Generating index page...');
        const indexPage = publishing.enhance(publishing.home(htmlGenerator.generateIndex(generatedPages, processedFiles)));
        await FileSystem.writeFile(indexPage.outputPath, indexPage.content);
        allPages.push(indexPage);
        logger.success('Index page generated');
      }

      logger.info('Generating tag pages...');
      const tagPages = htmlGenerator.generateTagPages(generatedPages);
      for (const rawTagPage of tagPages) {
        const tagPage = publishing.enhance(rawTagPage);
        await FileSystem.writeFile(tagPage.outputPath, tagPage.content);
        allPages.push(tagPage);
      }
      logger.success(`Generated ${tagPages.length} tag pages`);

      const archive = publishing.enhance(publishing.archive());
      await FileSystem.writeFile(archive.outputPath, archive.content);
      allPages.push(archive);
      await publishing.emit();

      // Delete only known generated pages, so a public-to-draft change cannot leave stale HTML.
      const manifestPath = path.join(this.config.output, '.generated-pages.json');
      const previous: string[] = await FileSystem.exists(manifestPath)
        ? JSON.parse(await FileSystem.readFile(manifestPath)) : [];
      const current = allPages.map(page => path.relative(this.config.output, page.outputPath));
      const hidden = vaultStructure.markdownFiles.filter(file => !publicFiles.includes(file)).flatMap(file => {
        const { frontmatter } = FrontMatterParser.parse(file.content);
        return [PathResolver.toOutputPath(file.absolutePath, this.config.source, this.config.output),
          PathResolver.noteOutputPath(file.absolutePath, this.config.source, this.config.output, frontmatter.permalink),
          ...redirectPaths(frontmatter.redirectFrom, this.config.output)]
          .map(outputPath => path.relative(this.config.output, outputPath));
      });
      for (const relative of new Set([...previous, ...hidden])) {
        const target = path.resolve(this.config.output, relative);
        if (!current.includes(relative) && relative.endsWith('.html') && target.startsWith(path.resolve(this.config.output) + path.sep)) await FileSystem.remove(target);
      }
      await FileSystem.writeFile(manifestPath, JSON.stringify(current));

      if (this.config.features.copyAssets) {
        const resourceCopier = new ResourceCopier(this.config.source, this.config.output);
        await resourceCopier.copyResources(vaultStructure.resources);
      }

      if (this.config.features.generateSitemap) {
        logger.info('Generating sitemap...');
        await this.generateSitemap(generatedPages);
        logger.success('Sitemap generated');
      } else {
        await FileSystem.remove(path.join(this.config.output, 'sitemap.xml'));
      }
      if (!publishing.options.rss || !this.config.site.url) {
        await FileSystem.remove(path.join(this.config.output, 'feed.xml'));
      }
      if (publishing.options.checkLinks || publishing.options.strictLinks) {
        const resolver = new WikiLinkResolver(publicFiles, this.config.output, this.config.source, this.config.basePath);
        for (const file of processedFiles) for (const link of file.links) {
          if (!resolver.resolve(`[[${link}]]`).url) deadLinks.push(`${file.sourcePath} -> [[${link}]]: missing or unpublished note`);
        }
        deadLinks.push(...await checkLinks(allPages, this.config));
        deadLinks.forEach(link => logger.warn(link));
        if (publishing.options.strictLinks && deadLinks.length) throw new Error(`Found ${deadLinks.length} broken internal links`);
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
      const urlPath = PathResolver.toUrlPath(page.outputPath, this.config.output, '/').slice(1);
      const fullUrl = baseUrl ? new URL(urlPath, baseUrl.replace(/\/$/, '') + '/').href : `${this.config.basePath}${urlPath}`;
      const lastmod = page.frontmatter.date || new Date().toISOString().split('T')[0];

      return `  <url>
    <loc>${escape(fullUrl)}</loc>
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
