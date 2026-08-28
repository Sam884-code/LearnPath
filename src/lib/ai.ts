import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "./env";

// Anthropic client for roadmap generation (SPEC §14.1). Model is claude-opus-5
// by default (ROADMAP_MODEL). Streaming + adaptive thinking per the current API.

let cached: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (cached) return cached;
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — required for roadmap generation (SPEC §14).");
  }
  cached = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return cached;
}

export type GenerationResult = {
  text: string;
  usage: { input: number; output: number };
  model: string;
};

// Ask Claude for a single JSON object. We instruct strict-JSON in the system
// prompt and parse the text ourselves (robust across SDK versions); callers
// validate the parsed object with Zod. Streamed to avoid HTTP timeouts on large
// roadmaps (per the API guidance for high max_tokens).
export async function generateJson(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<GenerationResult> {
  const env = getEnv();
  const client = getAnthropic();

  const stream = client.messages.stream({
    model: env.ROADMAP_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    thinking: { type: "adaptive" },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const message = await stream.finalMessage();
  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return {
    text,
    usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
    model: env.ROADMAP_MODEL,
  };
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
