import { PrismaClient } from "@prisma/client";
import { extractPdfPages } from "@/lib/pdf";
import { chunkPages } from "@/lib/chunk";
import { getEmbeddingProvider, toVectorLiteral } from "@/lib/embeddings";

// Ingest one textbook (SPEC §14.3): extract text → chunk → embed → store chunk
// vectors → mark ready. Called fire-and-forget after upload; all failures are
// captured on the textbook row (status=failed, error) so the UI can show them.
const EMBED_BATCH = 64;

export async function ingestTextbook(prisma: PrismaClient, textbookId: string, fileBuffer: Buffer): Promise<void> {
  await prisma.textbook.update({ where: { id: textbookId }, data: { status: "processing", error: null } });
  try {
    const { pages, pageCount } = await extractPdfPages(fileBuffer);
    const chunks = chunkPages(pages);
    if (chunks.length === 0) throw new Error("No extractable text found in the PDF");

    const provider = getEmbeddingProvider();
    // Idempotent re-ingest: clear any prior chunks first.
    await prisma.textbookChunk.deleteMany({ where: { textbookId } });

    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batch = chunks.slice(i, i + EMBED_BATCH);
      const vectors = await provider.embed(batch.map((c) => c.content));
      for (let j = 0; j < batch.length; j++) {
        const c = batch[j];
        await prisma.$executeRawUnsafe(
          `INSERT INTO textbook_chunks (id, created_at, textbook_id, chunk_index, content, page_start, page_end, token_count, embedding)
           VALUES (gen_random_uuid(), now(), $1::uuid, $2, $3, $4, $5, $6, $7::vector)`,
          textbookId,
          i + j,
          c.content,
          c.pageStart,
          c.pageEnd,
          c.tokenCount,
          toVectorLiteral(vectors[j]),
        );
      }
    }

    await prisma.textbook.update({
      where: { id: textbookId },
      data: { status: "ready", pageCount, error: null },
    });
  } catch (err) {
    await prisma.textbook.update({
      where: { id: textbookId },
      data: { status: "failed", error: (err as Error).message.slice(0, 500) },
    });
    throw err;
  }
}
