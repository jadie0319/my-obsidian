import { glob } from 'glob';
import path from 'path';
import fs from 'fs/promises';
import { VaultFile, VaultResource, VaultStructure } from '../types/VaultFile';
import { FileSystem } from '../utils/FileSystem';
import { PathResolver } from '../utils/PathResolver';
import { logger } from '../utils/Logger';

export class VaultReader {
  private sourceRoot: string;
  private excludePatterns: string[];

  constructor(sourceRoot: string, excludePatterns: string[] = []) {
    this.sourceRoot = PathResolver.resolveAbsolutePath(sourceRoot);
    this.excludePatterns = excludePatterns;
  }

  async scan(): Promise<VaultStructure> {
    logger.startSpinner('Scanning vault...');

    try {
      const markdownFiles = await this.scanMarkdownFiles();
      const resources = await this.scanResources();

      logger.succeedSpinner(`Found ${markdownFiles.length} markdown files and ${resources.length} resources`);

      return {
        markdownFiles,
        resources,
        totalFiles: markdownFiles.length + resources.length,
      };
    } catch (error) {
      logger.failSpinner('Failed to scan vault');
      throw error;
    }
  }

  private async scanMarkdownFiles(): Promise<VaultFile[]> {
    const pattern = '**/*.md';
    const ignore = this.buildIgnorePatterns();

    const files = await glob(pattern, {
      cwd: this.sourceRoot,
      ignore,
      absolute: false,
    });

    const vaultFiles: VaultFile[] = [];

    for (const file of files) {
      const absolutePath = path.join(this.sourceRoot, file);
      const content = await FileSystem.readFile(absolutePath);
      const parsedPath = path.parse(file);

      const stat = await fs.stat(absolutePath);

      vaultFiles.push({
        path: file,
        absolutePath,
        relativePath: file,
        content,
        isMarkdown: true,
        basename: parsedPath.name,
        extension: parsedPath.ext,
        createdAt: stat.birthtime,
        modifiedAt: stat.mtime,
      });
    }

    return vaultFiles;
  }

  private async scanResources(): Promise<VaultResource[]> {
    const imagePattern = '**/*.{png,jpg,jpeg,gif,svg,webp}';
    const attachmentPattern = '**/*.{pdf,doc,docx,xls,xlsx,zip}';
    const ignore = this.buildIgnorePatterns();

    const imageFiles = await glob(imagePattern, {
      cwd: this.sourceRoot,
      ignore,
      absolute: false,
    });

    const attachmentFiles = await glob(attachmentPattern, {
      cwd: this.sourceRoot,
      ignore,
      absolute: false,
    });

    const resources: VaultResource[] = [];

    for (const file of imageFiles) {
      resources.push({
        path: file,
        absolutePath: path.join(this.sourceRoot, file),
        relativePath: file,
        type: 'image',
      });
    }

    for (const file of attachmentFiles) {
      resources.push({
        path: file,
        absolutePath: path.join(this.sourceRoot, file),
        relativePath: file,
        type: 'attachment',
      });
    }

    return resources;
  }

  private buildIgnorePatterns(): string[] {
    const defaultIgnore = ['node_modules/**', '.git/**'];
    const userIgnore = this.excludePatterns.map(pattern => {
      return pattern.endsWith('/**') ? pattern : `${pattern}/**`;
    });

    return [...defaultIgnore, ...userIgnore];
  }
}
