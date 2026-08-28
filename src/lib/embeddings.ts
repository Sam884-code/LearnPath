import OpenAI from "openai";
import { getEnv } from "./env";

// Embeddings provider behind an interface so OpenAI can be swapped (Voyage, etc.)
// without touching the ingest/retrieve services (SPEC §14.1).
export interface EmbeddingProvider {
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 1536;
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await this.client.embeddings.create({ model: this.model, input: texts });
    // Preserve request order (the API returns objects with an `index`).
    return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

let cached: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) return cached;
  const env = getEnv();
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set — required for textbook embeddings (SPEC §14).");
  }
  cached = new OpenAIEmbeddingProvider(env.OPENAI_API_KEY, env.EMBEDDING_MODEL);
  return cached;
}

// Format a number[] as a pgvector literal, e.g. "[0.1,0.2,...]".
export function toVectorLiteral(vec: number[]): string {
  return "[" + vec.join(",") + "]";
}
