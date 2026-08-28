import { PrismaClient } from "@prisma/client";
import { getEmbeddingProvider, toVectorLiteral } from "@/lib/embeddings";

export type RetrievedChunk = {
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  title: string;
  similarity: number;
};

// Retrieve the top-k most relevant textbook chunks for a subject/grade (SPEC
// §14.3). Cosine distance (`<=>`) over pgvector, scoped to ready textbooks in
// the subject (and grade, when given).
export async function retrieveContext(
  prisma: PrismaClient,
  opts: { subjectId: string; gradeLevel: number | null; queryText: string; k?: number },
): Promise<RetrievedChunk[]> {
  const provider = getEmbeddingProvider();
  const [qvec] = await provider.embed([opts.queryText], "query");
  const rows = await prisma.$queryRawUnsafe<
    { content: string; pageStart: number | null; pageEnd: number | null; title: string; similarity: number }[]
  >(
    `SELECT c.content,
            c.page_start AS "pageStart",
            c.page_end   AS "pageEnd",
            t.title,
            (1 - (c.embedding <=> $1::vector))::float8 AS similarity
     FROM textbook_chunks c
     JOIN textbooks t ON t.id = c.textbook_id
     WHERE t.subject_id = $2::uuid
       AND t.status = 'ready'
       AND ($3::int IS NULL OR t.grade_level = $3::int)
     ORDER BY c.embedding <=> $1::vector
     LIMIT $4`,
    toVectorLiteral(qvec),
    opts.subjectId,
    opts.gradeLevel,
    opts.k ?? 12,
  );
  return rows;
}
