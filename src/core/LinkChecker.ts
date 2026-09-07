import { load } from 'cheerio';
import path from 'path';
import { GeneratedPage } from '../types/ParsedContent';
import { ObsidianConfig } from '../types/Config';
import { FileSystem } from '../utils/FileSystem';

export async function checkLinks(pages: GeneratedPage[], config: ObsidianConfig): Promise<string[]> {
  const problems = new Set<string>();
  const documents = new Map(pages.map(page => [path.resolve(page.outputPath), load(page.content)]));
  const origin = config.site.url ? new URL(config.site.url).origin : 'https://local.invalid';
  for (const page of pages) {
    const $ = documents.get(path.resolve(page.outputPath))!;
    const pageUrl = origin + config.basePath + path.relative(config.output, page.outputPath).split(path.sep).join('/');
    for (const node of $('a[href], script[src], link[href], img[src]').toArray()) {
      const href = $(node).attr('href') || $(node).attr('src') || '';
      if (!href || /^(?:mailto:|tel:|data:|javascript:)/i.test(href)) continue;
      try {
        const url = new URL(href, pageUrl);
        if (url.origin !== origin) continue;
        if (!url.pathname.startsWith(config.basePath)) throw new Error('outside basePath');
        let relative = decodeURIComponent(url.pathname.slice(config.basePath.length));
        if (!relative || relative.endsWith('/')) relative += 'index.html';
        const target = path.resolve(config.output, relative);
        if (!target.startsWith(path.resolve(config.output) + path.sep)) throw new Error('outside output');
        if (!(await FileSystem.exists(target))) throw new Error('missing file');
        if (url.hash && documents.has(target)) {
          const id = decodeURIComponent(url.hash.slice(1));
          if (!documents.get(target)!('[id]').toArray().some(el => documents.get(target)!(el).attr('id') === id)) throw new Error('missing heading');
        }
      } catch (error) { problems.add(`${path.relative(config.output, page.outputPath)} -> ${href}: ${(error as Error).message}`); }
    }
  }
  return [...problems];
}
