import path from 'path';
import { describe, expect, it } from 'vitest';
import { MarkdownProcessor } from '../src/core/MarkdownProcessor';
import { ConfigSchema } from '../src/types/Config';
import { VaultFile } from '../src/types/VaultFile';

describe('body wiki links', () => {
  it.each(['/', '/project-site/'])('uses the deployment prefix %s', async basePath => {
    const source = path.resolve('tests/fixtures/sample-vault');
    const file = (relativePath: string, content: string): VaultFile => ({
      path: relativePath,
      relativePath,
      absolutePath: path.join(source, relativePath),
      content,
      isMarkdown: true,
      basename: path.basename(relativePath, '.md'),
      extension: '.md',
    });
    const note = file('folder/Source.md', '[[Another Note|Read more]]\n\n[External](https://example.com/)');
    const target = file('notes/Another Note.md', '# Target');
    const config = ConfigSchema.parse({ source, output: path.resolve('dist'), basePath });
    const result = await new MarkdownProcessor(config, [note, target]).process(note);

    expect(result.html).toContain(`href="${basePath}notes/another-note.html">Read more</a>`);
    expect(result.html).toContain('href="https://example.com/"');
    expect(result.links).toEqual(['Another Note|Read more']);
  });
});
