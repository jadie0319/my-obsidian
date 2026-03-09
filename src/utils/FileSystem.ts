import fs from 'fs-extra';
import path from 'path';

export class FileSystem {
  static async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${(error as Error).message}`);
    }
  }

  static async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${(error as Error).message}`);
    }
  }

  static async copyFile(sourcePath: string, destPath: string): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(destPath));
      await fs.copy(sourcePath, destPath);
    } catch (error) {
      throw new Error(`Failed to copy file from ${sourcePath} to ${destPath}: ${(error as Error).message}`);
    }
  }

  static async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.ensureDir(dirPath);
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${(error as Error).message}`);
    }
  }

  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  static async remove(filePath: string): Promise<void> {
    try {
      await fs.remove(filePath);
    } catch (error) {
      throw new Error(`Failed to remove ${filePath}: ${(error as Error).message}`);
    }
  }
}
