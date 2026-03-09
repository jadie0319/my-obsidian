import { describe, expect, it } from 'vitest';
import { normalizeTags } from '../src/utils/Tags';

describe('normalizeTags', () => {
  it('flattens nested tags into standalone tags', () => {
    expect(normalizeTags(['ai/coding', 'writing'])).toEqual(['ai', 'coding', 'writing']);
  });

  it('deduplicates tags after flattening', () => {
    expect(normalizeTags(['ai/coding', 'coding/dev', 'ai'])).toEqual(['ai', 'coding', 'dev']);
  });

  it('removes blank tag segments', () => {
    expect(normalizeTags(['ai//coding', ' /ops/ ', ''])).toEqual(['ai', 'coding', 'ops']);
  });

  it('returns an empty array for missing tags', () => {
    expect(normalizeTags(undefined)).toEqual([]);
  });
});
