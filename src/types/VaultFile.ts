export interface VaultFile {
  path: string;
  absolutePath: string;
  relativePath: string;
  content: string;
  isMarkdown: boolean;
  basename: string;
  extension: string;
}

export interface VaultResource {
  path: string;
  absolutePath: string;
  relativePath: string;
  type: 'image' | 'attachment' | 'other';
}

export interface VaultStructure {
  markdownFiles: VaultFile[];
  resources: VaultResource[];
  totalFiles: number;
}
