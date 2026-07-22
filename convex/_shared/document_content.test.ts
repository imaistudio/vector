import { describe, expect, it } from 'vitest';
import { getUtf8ByteLength, splitDocumentContent } from './document_content';

describe('splitDocumentContent', () => {
  it('round-trips content without exceeding the UTF-8 chunk limit', () => {
    const content = `${'a'.repeat(19)}🙂${'界'.repeat(10)}end`;
    const chunks = splitDocumentContent(content, 20);

    expect(chunks.join('')).toBe(content);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => getUtf8ByteLength(chunk) <= 20)).toBe(true);
  });

  it('never separates a surrogate pair', () => {
    const chunks = splitDocumentContent('🙂🙂🙂', 4);

    expect(chunks).toEqual(['🙂', '🙂', '🙂']);
  });
});
