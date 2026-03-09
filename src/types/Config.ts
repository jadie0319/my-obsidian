import { z } from 'zod';

export const ConfigSchema = z.object({
  source: z.string().min(1, 'Source path is required'),
  output: z.string().default('./dist'),
  exclude: z.array(z.string()).default([]),
  basePath: z.string().default('/'),
  template: z.string().default('default'),

  site: z.object({
    title: z.string().default('My Digital Garden'),
    description: z.string().default(''),
    author: z.string().optional(),
    url: z.string().url().optional(),
  }).default({}),

  markdown: z.object({
    preserveWikiLinks: z.boolean().default(false),
    convertCallouts: z.boolean().default(true),
    syntaxHighlighting: z.boolean().default(true),
  }).default({}),

  features: z.object({
    generateIndex: z.boolean().default(true),
    generateSitemap: z.boolean().default(true),
    copyAssets: z.boolean().default(true),
  }).default({}),
});

export type ObsidianConfig = z.infer<typeof ConfigSchema>;

export interface CLIOptions {
  source?: string;
  output?: string;
  exclude?: string[];
  config?: string;
  basePath?: string;
  template?: string;
}
