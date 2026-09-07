import path from 'path';
import { GeneratedPage, ProcessedFile } from '../types/ParsedContent';
import { ObsidianConfig } from '../types/Config';
import { PathResolver } from '../utils/PathResolver';
import { escape, json } from './Publishing';

export function redirectPaths(value: unknown, output: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new Error('redirectFrom must be an array of site-relative paths');
  return [...new Set(value.map(item => PathResolver.fromPermalink(item, output)))];
}

export function planRoutes(files: ProcessedFile[], config: ObsidianConfig): GeneratedPage[] {
  const destinations = new Map<string, string>();
  const register = (outputPath: string, source: string) => {
    const relative = path.relative(path.resolve(config.output), path.resolve(outputPath)).split(path.sep).join('/');
    const key = relative.normalize('NFC').toLowerCase();
    const reserved = ['archive.html', 'index.html', 'feed.xml', 'sitemap.xml'];
    if (reserved.includes(key) || /^(assets|tags)\//.test(key) || key.startsWith('.') || !key.endsWith('.html')) throw new Error(`Conflicting output path: ${relative} (${source})`);
    if (destinations.has(key)) throw new Error(`Conflicting output path: ${relative} (${destinations.get(key)} and ${source})`);
    if ([...destinations.keys()].some(other => key.startsWith(other + '/') || other.startsWith(key + '/'))) throw new Error(`File/directory output collision: ${relative}`);
    destinations.set(key, source);
  };
  for (const file of files) register(file.outputPath, file.sourcePath);
  const redirects: GeneratedPage[] = [];
  for (const file of files) {
    const target = encodeURI(PathResolver.toUrlPath(file.outputPath, config.output, config.basePath));
    for (const outputPath of redirectPaths(file.frontmatter.redirectFrom, config.output)) {
      if (path.resolve(outputPath) === path.resolve(file.outputPath)) throw new Error(`Self redirect in ${file.sourcePath}`);
      register(outputPath, file.sourcePath + ' redirect');
      const canonical = config.site.url ? new URL(target.slice(config.basePath.length), config.site.url.replace(/\/$/, '') + '/').href : undefined;
      redirects.push({ outputPath, title: file.title, frontmatter: {}, content: `<!doctype html><html lang="${config.publishing?.language || 'en'}"><head><meta charset="utf-8"><title>${escape(file.title)}</title><meta name="robots" content="noindex">${canonical ? `<link rel="canonical" href="${escape(canonical)}">` : ''}<meta http-equiv="refresh" content="0;url=${escape(target)}"></head><body><a href="${escape(target)}">${escape(file.title)}</a><script>location.replace(${json(target)} + location.search + location.hash);</script></body></html>` });
    }
  }
  return redirects;
}
