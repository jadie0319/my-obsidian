import { VaultResource } from '../types/VaultFile';
import { FileSystem } from '../utils/FileSystem';
import { PathResolver } from '../utils/PathResolver';
import { logger } from '../utils/Logger';
import path from 'path';

export class ResourceCopier {
  private sourceRoot: string;
  private outputRoot: string;

  constructor(sourceRoot: string, outputRoot: string) {
    this.sourceRoot = sourceRoot;
    this.outputRoot = outputRoot;
  }

  async copyResources(resources: VaultResource[]): Promise<number> {
    logger.startSpinner(`Copying ${resources.length} resources...`);

    let copiedCount = 0;

    try {
      for (const resource of resources) {
        await this.copyResource(resource);
        copiedCount++;
      }

      await this.copyStyles();

      logger.succeedSpinner(`Copied ${copiedCount} resources`);
      return copiedCount;
    } catch (error) {
      logger.failSpinner('Failed to copy resources');
      throw error;
    }
  }

  private async copyResource(resource: VaultResource): Promise<void> {
    const parsedPath = path.parse(resource.relativePath);
    const slugifiedName = PathResolver.slugify(parsedPath.name);
    const fileName = slugifiedName + parsedPath.ext;

    let destPath: string;

    if (resource.type === 'image') {
      destPath = path.join(this.outputRoot, 'assets', 'attachments', fileName);
    } else {
      destPath = path.join(this.outputRoot, 'assets', 'attachments', fileName);
    }

    await FileSystem.copyFile(resource.absolutePath, destPath);
  }

  private async copyStyles(): Promise<void> {
    const files = [
      { from: 'styles.css', to: 'assets/styles/main.css' },
      { from: 'graph.css', to: 'assets/styles/graph.css' },
      { from: 'graph.js', to: 'assets/scripts/graph.js' },
    ];

    for (const { from, to } of files) {
      const sourcePath = path.join(__dirname, '../../templates/default', from);
      const destPath = path.join(this.outputRoot, to);
      await FileSystem.copyFile(sourcePath, destPath);
    }
  }
}
