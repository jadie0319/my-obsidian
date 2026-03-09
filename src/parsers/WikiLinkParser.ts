import { VaultFile } from '../types/VaultFile';
import { PathResolver } from '../utils/PathResolver';
import path from 'path';

export class WikiLinkResolver {
  private permalinkMap: Map<string, string>;

  constructor(vaultFiles: VaultFile[], outputRoot: string, sourceRoot: string) {
    this.permalinkMap = this.buildPermalinkMap(vaultFiles, outputRoot, sourceRoot);
  }

  resolve(wikiLink: string): { url: string | null; alias: string | null } {
    const cleanLink = wikiLink.replace(/[\[\]]/g, '');
    const [target, alias] = cleanLink.split('|').map(s => s.trim());

    const url = this.findTarget(target);

    return {
      url,
      alias: alias || null,
    };
  }

  private findTarget(target: string): string | null {
    if (this.permalinkMap.has(target)) {
      return this.permalinkMap.get(target)!;
    }

    const lowerTarget = target.toLowerCase();
    for (const [key, value] of this.permalinkMap) {
      if (key.toLowerCase() === lowerTarget) {
        return value;
      }
    }

    for (const [key, value] of this.permalinkMap) {
      if (key.toLowerCase().endsWith(lowerTarget.toLowerCase())) {
        return value;
      }
    }

    return null;
  }

  private buildPermalinkMap(
    vaultFiles: VaultFile[],
    outputRoot: string,
    sourceRoot: string
  ): Map<string, string> {
    const map = new Map<string, string>();

    for (const file of vaultFiles) {
      const filename = path.basename(file.path, '.md');
      const outputPath = PathResolver.toOutputPath(file.absolutePath, sourceRoot, outputRoot);
      const relativePath = path.relative(outputRoot, outputPath);
      const urlPath = '/' + relativePath.split(path.sep).join('/');

      map.set(filename, urlPath);
      map.set(file.path, urlPath);

      const pathWithoutExt = file.path.replace(/\.md$/, '');
      map.set(pathWithoutExt, urlPath);
    }

    return map;
  }

  getAllLinks(): Map<string, string> {
    return new Map(this.permalinkMap);
  }
}
