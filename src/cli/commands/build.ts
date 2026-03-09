import { CLIOptions } from '../../types/Config';
import { ConfigManager } from '../../utils/Config';
import { SiteBuilder } from '../../core/SiteBuilder';
import { logger } from '../../utils/Logger';

export async function buildCommand(options: CLIOptions): Promise<void> {
  try {
    const config = await ConfigManager.loadConfig(options.config, options);

    const builder = new SiteBuilder(config);
    const result = await builder.build();

    if (result.errors.length > 0) {
      logger.warn(`Build completed with ${result.errors.length} errors:`);
      result.errors.forEach(error => logger.error(error));
    }

    if (result.deadLinks.length > 0) {
      logger.warn(`Found ${result.deadLinks.length} dead links`);
    }
  } catch (error) {
    logger.error('Build failed', error as Error);
    process.exit(1);
  }
}
