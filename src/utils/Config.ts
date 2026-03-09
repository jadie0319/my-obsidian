import { ConfigSchema, ObsidianConfig, CLIOptions } from '../types/Config';
import { FileSystem } from './FileSystem';
import { logger } from './Logger';

export class ConfigManager {
  static async loadConfig(configPath?: string, cliOptions?: CLIOptions): Promise<ObsidianConfig> {
    let fileConfig = {};

    if (configPath) {
      try {
        const configContent = await FileSystem.readFile(configPath);
        fileConfig = JSON.parse(configContent);
        logger.info(`Loaded configuration from ${configPath}`);
      } catch (error) {
        logger.warn(`Failed to load config file ${configPath}, using defaults`);
      }
    }

    const mergedConfig = {
      ...fileConfig,
      ...this.cliOptionsToConfig(cliOptions),
    };

    try {
      return ConfigSchema.parse(mergedConfig);
    } catch (error) {
      logger.error('Configuration validation failed', error as Error);
      throw new Error('Invalid configuration. Please check your config file and CLI options.');
    }
  }

  private static cliOptionsToConfig(cliOptions?: CLIOptions): Partial<ObsidianConfig> {
    if (!cliOptions) {
      return {};
    }

    return {
      ...(cliOptions.source && { source: cliOptions.source }),
      ...(cliOptions.output && { output: cliOptions.output }),
      ...(cliOptions.exclude && { exclude: cliOptions.exclude }),
      ...(cliOptions.basePath && { basePath: cliOptions.basePath }),
      ...(cliOptions.template && { template: cliOptions.template }),
    };
  }

  static async generateConfigFile(outputPath: string): Promise<void> {
    const defaultConfig: ObsidianConfig = ConfigSchema.parse({
      source: './vault',
      output: './dist',
      exclude: ['.obsidian', '.trash'],
      basePath: '/',
      template: 'default',
      site: {
        title: 'My Digital Garden',
        description: 'My notes published from Obsidian',
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
    });

    const configContent = JSON.stringify(defaultConfig, null, 2);
    await FileSystem.writeFile(outputPath, configContent);
    logger.success(`Configuration file created at ${outputPath}`);
  }
}
