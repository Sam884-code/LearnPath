// Page-aware text chunking for RAG (SPEC §14.3). Concatenates page text and
// splits into ~600-token windows (~2400 chars) with ~80-token overlap, tracking
// which pages each chunk spans.

export type Chunk = { content: string; pageStart: number; pageEnd: number; tokenCount: number };

const TARGET_CHARS = 2400;
const OVERLAP_CHARS = 320;

export function chunkPages(pages: string[]): Chunk[] {
  const boundaries: { start: number; page: number }[] = [];
  let full = "";
  pages.forEach((text, idx) => {
    boundaries.push({ start: full.length, page: idx + 1 });
    full += (text || "") + "\n";
  });
  full = full.trim();
  if (full.length === 0) return [];

  const pageAt = (offset: number): number => {
    let page = 1;
    for (const b of boundaries) {
      if (b.start <= offset) page = b.page;
      else break;
    }
    return page;
  };

  const chunks: Chunk[] = [];
  let start = 0;
  while (start < full.length) {
    let end = Math.min(start + TARGET_CHARS, full.length);
    if (end < full.length) {
      // Prefer a natural break near the end of the window.
      const slice = full.slice(start, end);
      const brk = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
      if (brk > TARGET_CHARS * 0.6) end = start + brk + 1;
    }
    const content = full.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({
        content,
        pageStart: pageAt(start),
        pageEnd: pageAt(end - 1),
        tokenCount: Math.ceil(content.length / 4),
      });
    }
    if (end >= full.length) break;
    start = Math.max(0, end - OVERLAP_CHARS);
  }
  return chunks;
}
