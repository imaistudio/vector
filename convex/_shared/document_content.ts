import { getConvexSize, getDocumentSize } from 'convex/values';
import type { Doc } from '../_generated/dataModel';

export const MAX_CONVEX_DOCUMENT_BYTES = 1 << 20;
export const DOCUMENT_CONTENT_CHUNK_BYTES = 256 * 1024;
export const DOCUMENT_CONTENT_PAGE_SIZE = 3;

export function getUtf8ByteLength(value: string) {
  return getConvexSize(value) - 2;
}

export function getInlineDocumentSize(
  document: Doc<'documents'>,
  title: string,
  content: string,
) {
  const {
    contentVersion: _contentVersion,
    contentChunkCount: _contentChunkCount,
    contentSize: _contentSize,
    ...inlineDocument
  } = document;
  return getDocumentSize({
    ...inlineDocument,
    title,
    content,
  });
}

export function getInlineDocumentSizeFromContentBytes(
  document: Doc<'documents'>,
  title: string,
  contentBytes: number,
) {
  const emptyContentSize = getInlineDocumentSize(document, title, '');
  return emptyContentSize + contentBytes;
}

export function splitDocumentContent(
  content: string,
  maxBytes = DOCUMENT_CONTENT_CHUNK_BYTES,
) {
  if (maxBytes < 4) throw new Error('Chunk size must be at least 4 bytes');

  const chunks: string[] = [];
  let chunkStart = 0;
  let chunkBytes = 0;

  for (let index = 0; index < content.length;) {
    const codePoint = content.codePointAt(index)!;
    const width = codePoint > 0xffff ? 2 : 1;
    const bytes =
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;

    if (chunkBytes > 0 && chunkBytes + bytes > maxBytes) {
      chunks.push(content.slice(chunkStart, index));
      chunkStart = index;
      chunkBytes = 0;
    }

    chunkBytes += bytes;
    index += width;
  }

  if (chunkStart < content.length || chunks.length === 0) {
    chunks.push(content.slice(chunkStart));
  }

  return chunks;
}
