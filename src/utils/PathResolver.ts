import path from 'path';

export class PathResolver {
  static slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-가-힣]/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  static toOutputPath(sourcePath: string, sourceRoot: string, outputRoot: string): string {
    const relativePath = path.relative(sourceRoot, sourcePath);
    const parsedPath = path.parse(relativePath);

    const slugifiedName = this.slugify(parsedPath.name);
    const outputPath = path.join(
      outputRoot,
      parsedPath.dir,
      `${slugifiedName}.html`
    );

    return outputPath;
  }

  static toUrlPath(outputPath: string, outputRoot: string, basePath: string): string {
    const relativePath = path.relative(outputRoot, outputPath);
    const urlPath = relativePath.split(path.sep).join('/');

    const url = path.posix.join(basePath, urlPath);
    return url.endsWith('/index.html') ? url.slice(0, -'index.html'.length) : url;
  }

  static fromPermalink(value: unknown, outputRoot: string): string {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
      throw new Error('permalink/redirectFrom must be a site-relative path starting with /');
    }
    let decoded: string;
    try { decoded = decodeURIComponent(value); } catch { throw new Error('Invalid URL encoding in permalink/redirectFrom'); }
    if (/[\\?#%]/.test(decoded) || [...decoded].some(char => char.charCodeAt(0) < 0x20) || decoded.startsWith('//')) throw new Error('Invalid characters in permalink/redirectFrom');
    const segments = decoded.slice(1).replace(/\/$/, '').split('/');
    if (segments.some(segment => !segment || segment === '.' || segment === '..' || segment.includes(':'))) throw new Error('Invalid path segments in permalink/redirectFrom');
    const relative = segments.join('/');
    if (path.posix.extname(relative) && !relative.endsWith('.html')) throw new Error('permalink/redirectFrom must end with / or .html');
    return path.resolve(outputRoot, relative.endsWith('.html') ? relative : `${relative}/index.html`);
  }

  static noteOutputPath(sourcePath: string, sourceRoot: string, outputRoot: string, permalink?: unknown): string {
    return permalink === undefined ? this.toOutputPath(sourcePath, sourceRoot, outputRoot) : this.fromPermalink(permalink, outputRoot);
  }

  static resolveWikiLink(linkText: string, permalinkMap: Map<string, string>): string | null {
    const cleanLink = linkText.replace(/[[\]]/g, '');
    const [target] = cleanLink.split('|');
    const trimmedTarget = target.trim();

    if (permalinkMap.has(trimmedTarget)) {
      return permalinkMap.get(trimmedTarget)!;
    }

    const lowerTarget = trimmedTarget.toLowerCase();
    for (const [key, value] of permalinkMap) {
      if (key.toLowerCase() === lowerTarget) {
        return value;
      }
    }

    for (const [key, value] of permalinkMap) {
      if (key.toLowerCase().endsWith(lowerTarget.toLowerCase())) {
        return value;
      }
    }

    return null;
  }

  static normalizePath(inputPath: string): string {
    return path.normalize(inputPath);
  }

  static resolveAbsolutePath(inputPath: string, basePath: string = process.cwd()): string {
    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }
    return path.resolve(basePath, inputPath);
  }
}
