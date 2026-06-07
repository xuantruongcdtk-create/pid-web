export interface ChunkOptions {
  size?: number;
  overlap?: number;
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const size = options.size ?? 1000;
  const overlap = options.overlap ?? 200;

  if (text.length <= size) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    
    // Move starting position forward by (size - overlap)
    start += size - overlap;
  }

  return chunks;
}
