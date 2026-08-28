import { PrismaClient, Track } from "@prisma/client";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { generateJson, extractJson } from "@/lib/ai";
import { ApiError } from "@/lib/errors";
import { retrieveContext } from "./roadmapRetrieve";

// The JSON shape we ask Claude to return, validated before it touches the DB.
const questionSchema = z.object({
  text: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(6),
  correct_index: z.number().int().min(0),
  explanation: z.string().min(1),
});
const stepSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["lesson", "quiz", "assignment"]),
  description: z.string().min(1),
  estimated_minutes: z.number().int().positive().max(600),
  pass_score: z.number().int().min(0).max(100).optional(),
  questions: z.array(questionSchema).optional(),
});
const roadmapSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  steps: z.array(stepSchema).min(3).max(20),
});

export type GeneratedRoadmap = { templateId: string; generationId: string; stepCount: number };

// Retrieve KB context → ask Claude for a structured roadmap → validate → write a
// DRAFT RoadmapTemplate + steps (+ quiz questions) the teacher then reviews and
// publishes (SPEC §14.3). The template is never auto-published.
export async function generateRoadmap(
  prisma: PrismaClient,
  opts: { subjectId: string; gradeLevel: number | null; track: Track; teacherId: string },
): Promise<GeneratedRoadmap> {
  const env = getEnv();
  const subject = await prisma.subject.findUnique({ where: { id: opts.subjectId } });
  if (!subject) throw new ApiError(404, "NOT_FOUND", "Subject not found");

  const gen = await prisma.roadmapGeneration.create({
    data: {
      subjectId: opts.subjectId,
      gradeLevel: opts.gradeLevel,
      track: opts.track,
      model: env.ROADMAP_MODEL,
      status: "pending",
      createdById: opts.teacherId,
    },
  });

  try {
    const gradePart = opts.gradeLevel ? `, grade ${opts.gradeLevel}` : "";
    const query = `${subject.title}${gradePart}, ${opts.track} track learning roadmap key concepts`;
    const context = await retrieveContext(prisma, {
      subjectId: opts.subjectId,
      gradeLevel: opts.gradeLevel,
      queryText: query,
      k: 12,
    });
    if (context.length === 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "No textbook content found for this subject/grade — upload a textbook first");
    }

    const contextText = context
      .map((c, i) => `[Source ${i + 1} · ${c.title}${c.pageStart ? `, p.${c.pageStart}` : ""}]\n${c.content}`)
      .join("\n\n");

    const system =
      "You are a curriculum designer for LearnPath, an Armenian educational roadmap platform. " +
      "You output ONLY a single JSON object (no prose, no code fences) matching the requested schema. " +
      "Every student-facing string (title, description, step titles/descriptions, quiz question text, options, explanations) MUST be in Armenian (hy). " +
      "Ground the roadmap in the provided textbook context; do not invent facts beyond it.";

    const trackHint =
      opts.track === "exam"
        ? "Focus on exam readiness: concise concept coverage, frequent quizzes."
        : "Focus on depth of understanding: thorough lessons, applied assignments.";

    const user =
      `Design a step-by-step learning roadmap for "${subject.title}"${gradePart} (${opts.track} track). ${trackHint}\n\n` +
      "Rules:\n" +
      "- 8–14 ordered steps; each step is a lesson, quiz, or assignment.\n" +
      "- Every quiz step includes 3–6 questions, each with 2–6 options, a 0-based correct_index, and an explanation.\n" +
      "- estimated_minutes is realistic per step; pass_score is 0–100 (default 60) for quiz/assignment.\n\n" +
      "Return JSON exactly of this shape:\n" +
      `{"title": string, "description": string, "steps": [{"title": string, "type": "lesson"|"quiz"|"assignment", "description": string, "estimated_minutes": number, "pass_score"?: number, "questions"?: [{"text": string, "options": string[], "correct_index": number, "explanation": string}]}]}\n\n` +
      `--- TEXTBOOK CONTEXT ---\n${contextText}`;

    const result = await generateJson({ system, user, maxTokens: 32000 });
    const parsed = roadmapSchema.parse(extractJson(result.text));

    const template = await prisma.roadmapTemplate.create({
      data: {
        subjectId: opts.subjectId,
        track: opts.track,
        title: parsed.title,
        description: parsed.description,
        authorId: opts.teacherId,
        isPublished: false,
      },
    });

    for (let i = 0; i < parsed.steps.length; i++) {
      const s = parsed.steps[i];
      const step = await prisma.templateStep.create({
        data: {
          templateId: template.id,
          orderIndex: i + 1,
          title: s.title,
          description: s.description,
          type: s.type,
          estimatedMinutes: s.estimated_minutes,
          passScore: s.pass_score ?? 60,
        },
      });
      if (s.type === "quiz" && s.questions?.length) {
        for (let q = 0; q < s.questions.length; q++) {
          const qq = s.questions[q];
          await prisma.question.create({
            data: {
              templateStepId: step.id,
              orderIndex: q + 1,
              text: qq.text,
              options: qq.options,
              correctIndex: qq.correct_index,
              explanation: qq.explanation,
            },
          });
        }
      }
    }

    await prisma.roadmapGeneration.update({
      where: { id: gen.id },
      data: {
        status: "ready",
        templateId: template.id,
        promptTokens: result.usage.input,
        outputTokens: result.usage.output,
      },
    });

    return { templateId: template.id, generationId: gen.id, stepCount: parsed.steps.length };
  } catch (err) {
    await prisma.roadmapGeneration.update({
      where: { id: gen.id },
      data: { status: "failed", error: (err as Error).message.slice(0, 500) },
    });
    throw err;
  }
}
