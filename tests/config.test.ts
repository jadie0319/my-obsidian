import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigManager } from '../src/utils/Config';

const tempDirs: string[] = [];

async function createTempConfig(config: Record<string, unknown>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-obsidian-config-'));
  tempDirs.push(dir);

  const configPath = path.join(dir, 'obsidian.config.json');
  await fs.writeJson(configPath, config, { spaces: 2 });

  return configPath;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.remove(dir)));
});

describe('ConfigManager.loadConfig', () => {
  it('loads source from config without requiring CLI --source', async () => {
    const configPath = await createTempConfig({
      source: './vault',
      output: './public',
    });

    const config = await ConfigManager.loadConfig(configPath);

    expect(config.source).toBe('./vault');
    expect(config.output).toBe('./public');
  });

  it('prefers CLI --source over config source', async () => {
    const configPath = await createTempConfig({
      source: './vault',
      output: './public',
    });

    const config = await ConfigManager.loadConfig(configPath, {
      source: './override-vault',
    });

    expect(config.source).toBe('./override-vault');
    expect(config.output).toBe('./public');
  });

  it('throws a clear error when source is missing from both config and CLI', async () => {
    const configPath = await createTempConfig({
      output: './public',
    });

    await expect(ConfigManager.loadConfig(configPath)).rejects.toThrow(
      'Invalid configuration: source is required. Provide it with --source or in your config file.'
    );
  });

  it('normalizes basePath from config for project GitHub Pages sites', async () => {
    const configPath = await createTempConfig({
      source: './vault',
      basePath: 'project-site',
    });

    const config = await ConfigManager.loadConfig(configPath);

    expect(config.basePath).toBe('/project-site/');
  });

  it('normalizes basePath from CLI options', async () => {
    const configPath = await createTempConfig({
      source: './vault',
      basePath: '/',
    });

    const config = await ConfigManager.loadConfig(configPath, {
      basePath: '/project-site',
    });

    expect(config.basePath).toBe('/project-site/');
  });
});
