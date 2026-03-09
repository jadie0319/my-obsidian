import { ConfigManager } from '../../utils/Config';
import { logger } from '../../utils/Logger';

export async function initCommand(options: { output?: string }): Promise<void> {
  try {
    const outputPath = options.output || './obsidian.config.json';
    await ConfigManager.generateConfigFile(outputPath);
  } catch (error) {
    logger.error('Failed to generate config file', error as Error);
    process.exit(1);
  }
}
