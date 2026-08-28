import { GoogleGenAI } from "@google/genai";
import { getEnv } from "./env";

// Google Gemini client for roadmap generation (SPEC §14.1). Model is
// gemini-3.5-flash by default (ROADMAP_MODEL). JSON output is requested via
// responseMimeType; callers validate the parsed object with Zod.

let cached: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (cached) return cached;
  const env = getEnv();
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set — required for roadmap generation (SPEC §14).");
  }
  cached = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return cached;
}

export type GenerationResult = {
  text: string;
  usage: { input: number; output: number };
  model: string;
};

const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|network|socket hang up|EAI_AGAIN|503|overloaded/i;

// Ask Gemini for a single JSON object. Retries transient network failures a
// couple of times (this feature runs against Google's API, which can blip).
export async function generateJson(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<GenerationResult> {
  const env = getEnv();
  const ai = getGemini();

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model: env.ROADMAP_MODEL,
        contents: opts.user,
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          maxOutputTokens: opts.maxTokens ?? 32000,
          temperature: 0.4,
        },
      });
      const usage = res.usageMetadata;
      return {
        text: res.text ?? "",
        usage: { input: usage?.promptTokenCount ?? 0, output: usage?.candidatesTokenCount ?? 0 },
        model: env.ROADMAP_MODEL,
      };
    } catch (err) {
      lastErr = err;
      const msg = (err as Error)?.message ?? String(err);
      if (!TRANSIENT.test(msg) || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Pull the first JSON object out of a model response (tolerates ```json fences
// or surrounding prose).
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Model response did not contain a JSON object");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
