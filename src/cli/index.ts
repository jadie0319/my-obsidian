#!/usr/bin/env node

import { Command } from 'commander';
import { buildCommand } from './commands/build';
import { initCommand } from './commands/init';

const program = new Command();

program
  .name('my-obsidian')
  .description('Convert Obsidian vault to GitHub Pages static site')
  .version('1.0.0');

program
  .command('build')
  .description('Build static site from Obsidian vault')
  .option('-s, --source <path>', 'Source vault directory')
  .option('-o, --output <path>', 'Output directory', './dist')
  .option('-e, --exclude <patterns...>', 'Exclude directories/files')
  .option('-c, --config <path>', 'Configuration file')
  .option('--base-path <path>', 'Base path for URLs', '/')
  .option('--template <name>', 'Template to use', 'default')
  .action(buildCommand);

program
  .command('init')
  .description('Initialize configuration file')
  .option('-o, --output <path>', 'Config file path', './obsidian.config.json')
  .action(initCommand);

program.parse();
