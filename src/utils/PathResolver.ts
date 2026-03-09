import path from 'path';

export class PathResolver {
  static slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-가-힣]/g, '')
      .replace(/\-\-+/g, '-')
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

    return path.posix.join(basePath, urlPath);
  }

  static resolveWikiLink(linkText: string, permalinkMap: Map<string, string>): string | null {
    const cleanLink = linkText.replace(/[\[\]]/g, '');
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
