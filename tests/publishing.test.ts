import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { load } from 'cheerio';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigSchema } from '../src/types/Config';
import { SiteBuilder } from '../src/core/SiteBuilder';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(dir => fs.remove(dir))); });
async function fixture(basePath = '/garden/') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'garden-publishing-'));
  directories.push(dir);
  const source = path.join(dir, 'vault');
  const output = path.join(dir, 'site');
  await fs.ensureDir(source);
  await fs.writeFile(path.join(source, 'First.md'), '---\ntitle: First\ncreated: 2026-01-01\nseries: Learning\nseriesOrder: 1\ntags: [ai]\nstatus: budding\n---\n# First\n\n## Hello\n\nKorean 검색어 text. [[Second|Next]]');
  await fs.writeFile(path.join(source, 'Second.md'), '---\ntitle: Second\ncreated: 2026-02-01\nseries: Learning\nseriesOrder: 2\n---\n# Second\n\n## Hello\n\n## Hello\n\nText & more');
  await fs.writeFile(path.join(source, 'Private.md'), '---\ndraft: true\n---\n# Private\n\nSECRET-TEXT');
  const config = ConfigSchema.parse({ source, output, basePath, site: { url: 'https://example.com' + basePath, title: 'Garden & Notes' }, publishing: { language: 'ko', strictLinks: true } });
  return { source, output, config };
}

describe('publishing pipeline', () => {
  it.each(['/', '/garden/'])('builds discoverable pages, RSS and stable headings at %s', async basePath => {
    const { config, output } = await fixture(basePath);
    const result = await new SiteBuilder(config).build();
    expect(result.errors).toEqual([]);
    expect(result.deadLinks).toEqual([]);
    expect(result.pagesGenerated).toBe(2);
    const home = load(await fs.readFile(path.join(output, 'index.html'), 'utf8'));
    expect(home('.garden-card > a').first().text()).toBe('Second');
    expect(home('.garden-home > *').first().hasClass('garden-intro')).toBe(true);
    expect(home('.garden-global').length).toBe(1);
    const first = load(await fs.readFile(path.join(output, 'first.html'), 'utf8'));
    expect(first('h1').length).toBe(1);
    expect(first('.mobile-toc a').attr('href')).toBe('#hello');
    expect(first('.garden-series a[aria-current="page"]').text()).toBe('First');
    expect(first('.garden-local svg a').attr('href')).toBe(basePath + 'second.html');
    expect(first('link[rel="canonical"]').attr('href')).toBe('https://example.com' + basePath + 'first.html');
    const second = load(await fs.readFile(path.join(output, 'second.html'), 'utf8'));
    expect(second('.content h2').map((_, node) => second(node).attr('id')).get()).toEqual(['hello', 'hello-2']);
    const catalog = await fs.readJson(path.join(output, 'assets/search-index.json'));
    expect(catalog).toHaveLength(2);
    expect(catalog[1].text).toContain('검색어');
    expect(await fs.pathExists(path.join(output, 'private.html'))).toBe(false);
    const rss = load(await fs.readFile(path.join(output, 'feed.xml'), 'utf8'), { xml: true });
    expect(rss('channel > title').text()).toBe('Garden & Notes');
    expect(rss('item').length).toBe(2);
    expect(rss('item link').first().text()).toBe('https://example.com' + basePath + 'second.html');
  });

  it('removes previously public pages when they become private', async () => {
    const { source, output, config } = await fixture();
    await new SiteBuilder(config).build();
    await fs.writeFile(path.join(source, 'Second.md'), '---\npublished: false\n---\n# Second');
    config.publishing!.strictLinks = false;
    const result = await new SiteBuilder(config).build();
    expect(result.deadLinks.join(' ')).toContain('missing or unpublished');
    expect(await fs.pathExists(path.join(output, 'second.html'))).toBe(false);
    expect(JSON.stringify(await fs.readJson(path.join(output, 'assets/search-index.json')))).not.toContain('"title":"Second"');
  });

  it('reports missing assets and anchors and fails strict builds', async () => {
    const { source, config } = await fixture();
    await fs.appendFile(path.join(source, 'First.md'), '\n\n![Missing](missing.png)\n\n[Missing heading](#absent)');
    await expect(new SiteBuilder(config).build()).rejects.toThrow('broken internal links');
    config.publishing!.strictLinks = false;
    const result = await new SiteBuilder(config).build();
    expect(result.deadLinks.join(' ')).toContain('missing.png');
    expect(result.deadLinks.join(' ')).toContain('missing heading');
  });

  it('supports disabled features and safe metadata serialization', async () => {
    const { source, config, output } = await fixture();
    config.site.url = undefined;
    config.publishing = { ...config.publishing!, search: false, previews: false, localGraph: false, rss: false, homeOrder: ['recent', 'intro'] };
    await fs.writeFile(path.join(source, 'Third.md'), '---\ntitle: "</script><script>alert(1)</script>"\n---\n# Safe');
    await new SiteBuilder(config).build();
    const $ = load(await fs.readFile(path.join(output, 'index.html'), 'utf8'));
    expect($('#garden-search').length).toBe(0);
    expect($('.garden-global').length).toBe(0);
    expect($('script').toArray().some(node => $(node).text() === 'alert(1)')).toBe(false);
    expect(await fs.pathExists(path.join(output, 'feed.xml'))).toBe(false);
    expect($('link[rel="canonical"]').length).toBe(0);
  });

  it('keeps archive and tag navigation valid when the home index is disabled', async () => {
    const { config, output } = await fixture();
    config.features.generateIndex = false;
    const result = await new SiteBuilder(config).build();
    expect(result.deadLinks).toEqual([]);
    expect(await fs.pathExists(path.join(output, 'index.html'))).toBe(false);
    expect(await fs.pathExists(path.join(output, 'tags/ai/index.html'))).toBe(true);
  });

  it('rejects a note that would overwrite the archive', async () => {
    const { source, config } = await fixture();
    await fs.writeFile(path.join(source, 'Archive.md'), '# Archive');
    await expect(new SiteBuilder(config).build()).rejects.toThrow('Conflicting output path: archive.html');
  });
});
