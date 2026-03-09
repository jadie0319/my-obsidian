export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags || tags.length === 0) {
    return [];
  }

  const normalizedTags = new Set<string>();

  for (const tag of tags) {
    for (const part of tag.split('/')) {
      const normalizedTag = part.trim();
      if (normalizedTag) {
        normalizedTags.add(normalizedTag);
      }
    }
  }

  return Array.from(normalizedTags);
}
