import path from 'path';
import { describe, expect, it } from 'vitest';
import { HTMLGenerator } from '../src/core/HTMLGenerator';
import { ObsidianConfig } from '../src/types/Config';
import { ProcessedFile } from '../src/types/ParsedContent';

function createConfig(basePath: string): ObsidianConfig {
  return {
    source: './vault',
    output: './dist',
    exclude: [],
    basePath,
    template: 'default',
    site: {
      title: 'My Digital Garden',
      description: 'My notes',
      author: '',
    },
    markdown: {
      preserveWikiLinks: false,
      convertCallouts: true,
      syntaxHighlighting: true,
    },
    features: {
      generateIndex: true,
      generateSitemap: true,
      copyAssets: true,
    },
  };
}

function createProcessedFile(name: string, outputPath: string): ProcessedFile {
  return {
    html: `<p>${name}</p>`,
    frontmatter: {
      description: `${name} description`,
      date: '2026-03-09',
      tags: ['test'],
    },
    links: [],
    embeds: [],
    title: name,
    slug: name.toLowerCase(),
    outputPath,
    sourcePath: `./vault/${name}.md`,
  };
}

describe('HTMLGenerator', () => {
  it('renders asset and page URLs under the configured basePath', async () => {
    const config = createConfig('/project-site/');
    const generator = new HTMLGenerator(config);

    await generator.initialize();

    const processedFile = createProcessedFile('README', path.join(config.output, 'readme.html'));
    const page = generator.generatePage(processedFile);
    const index = generator.generateIndex([page], [processedFile]);

    expect(page.content).toContain('href="/project-site/assets/styles/main.css"');
    expect(index.content).toContain('href="/project-site/assets/styles/graph.css"');
    expect(index.content).toContain('src="/project-site/assets/scripts/graph.js"');
    expect(index.content).toContain('"url":"/project-site/readme.html"');
  });

  it('generates flat tag pages and links for normalized tags', async () => {
    const config = createConfig('/project-site/');
    const generator = new HTMLGenerator(config);

    await generator.initialize();

    const processedFile: ProcessedFile = {
      ...createProcessedFile('README', path.join(config.output, 'readme.html')),
      frontmatter: {
        description: 'README description',
        date: '2026-03-09',
        tags: ['ai', 'coding'],
      },
    };

    const page = generator.generatePage(processedFile);
    const tagPages = generator.generateTagPages([page]);
    const index = generator.generateIndex([page], [processedFile]);

    expect(page.content).toContain('href="/project-site/tags/ai/" class="tag"');
    expect(page.content).toContain('href="/project-site/tags/coding/" class="tag"');

    expect(tagPages).toHaveLength(2);
    expect(tagPages.map(tagPage => tagPage.outputPath)).toEqual(
      expect.arrayContaining([
        path.join(config.output, 'tags', 'ai', 'index.html'),
        path.join(config.output, 'tags', 'coding', 'index.html'),
      ])
    );

    expect(index.content).toContain("var url = basePath + 'tags/' + tag + '/';");
    expect(index.content).not.toContain("tag.split('/')");
  });
});
