import { GoogleGenAI } from "@google/genai";
import { getEnv } from "./env";

// Embeddings provider behind an interface so the model/vendor can be swapped
// without touching the ingest/retrieve services (SPEC §14.1). Uses Google
// Gemini (gemini-embedding-001) at 1536 dimensions to match the pgvector column.
export type EmbedTaskType = "document" | "query";

export interface EmbeddingProvider {
  readonly dimensions: number;
  embed(texts: string[], task?: EmbedTaskType): Promise<number[][]>;
}

const DIMENSIONS = 1536;
const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|network|socket hang up|EAI_AGAIN|503|overloaded|429|RESOURCE_EXHAUSTED/i;

class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = DIMENSIONS;
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async embed(texts: string[], task: EmbedTaskType = "document"): Promise<number[][]> {
    if (texts.length === 0) return [];
    const taskType = task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await this.client.models.embedContent({
          model: this.model,
          contents: texts,
          config: { outputDimensionality: DIMENSIONS, taskType },
        });
        return (res.embeddings ?? []).map((e) => e.values ?? []);
      } catch (err) {
        lastErr = err;
        const msg = (err as Error)?.message ?? String(err);
        if (!TRANSIENT.test(msg) || attempt === 2) break;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    throw lastErr;
  }
}

let cached: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) return cached;
  const env = getEnv();
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set — required for textbook embeddings (SPEC §14).");
  }
  cached = new GeminiEmbeddingProvider(env.GEMINI_API_KEY, env.EMBEDDING_MODEL);
  return cached;
}

// Format a number[] as a pgvector literal, e.g. "[0.1,0.2,...]".
export function toVectorLiteral(vec: number[]): string {
  return "[" + vec.join(",") + "]";
}
