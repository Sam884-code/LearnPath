import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient, StepType, Track } from "@prisma/client";
import { ApiError } from "@/lib/errors";
import { sniffAllowedMimeType } from "@/lib/fileSniff";
import { sanitizeFileName } from "@/lib/sanitizeFileName";
import type { StorageDriver } from "@/lib/storage/types";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// SPEC.md §5.8: GET /teacher/templates.
// Any teacher can see and manage any template — the spec doesn't scope this
// to "templates I authored," and nothing else in the MVP implies per-teacher
// content silos.
export async function listTemplates(prisma: PrismaClient) {
  return prisma.roadmapTemplate.findMany({
    include: { subject: true, steps: { select: { id: true, type: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// GET /teacher/templates/:id — full detail for the editor. Unlike the student
// quiz endpoint, teacher responses DO include correct_index (teachers author
// the answers).
export async function getTemplateDetail(prisma: PrismaClient, templateId: string) {
  const template = await prisma.roadmapTemplate.findUnique({
    where: { id: templateId },
    include: {
      subject: true,
      steps: {
        orderBy: { orderIndex: "asc" },
        include: {
          questions: { orderBy: { orderIndex: "asc" } },
          materials: true,
        },
      },
    },
  });
  if (!template) {
    throw new ApiError(404, "NOT_FOUND", "Template not found");
  }

  // Reshape into a JSON-safe object: material.sizeBytes is a BigInt, which
  // NextResponse.json (JSON.stringify) can't serialize. Field names stay
  // camelCase to match the Prisma model the rest of the code uses.
  return {
    id: template.id,
    subjectId: template.subjectId,
    track: template.track,
    title: template.title,
    description: template.description,
    isPublished: template.isPublished,
    subject: {
      id: template.subject.id,
      title: template.subject.title,
      slug: template.subject.slug,
      icon: template.subject.icon,
    },
    steps: template.steps.map((s) => ({
      id: s.id,
      orderIndex: s.orderIndex,
      title: s.title,
      description: s.description,
      type: s.type,
      passScore: s.passScore,
      maxAttempts: s.maxAttempts,
      estimatedMinutes: s.estimatedMinutes,
      questions: s.questions.map((q) => ({
        id: q.id,
        orderIndex: q.orderIndex,
        text: q.text,
        options: q.options as string[],
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      })),
      materials: s.materials.map((m) => ({
        id: m.id,
        fileName: m.fileName,
        sizeBytes: Number(m.sizeBytes),
      })),
    })),
  };
}

// Reassign order_index for a template's steps to match the given id order.
// Done in two passes inside a transaction: the unique(template_id, order_index)
// index would reject a direct swap, so every step is first moved to a distinct
// high offset, then to its final 1-based position.
export async function reorderSteps(prisma: PrismaClient, templateId: string, orderedStepIds: string[]) {
  const steps = await prisma.templateStep.findMany({ where: { templateId } });
  const ids = new Set(steps.map((s) => s.id));
  if (orderedStepIds.length !== steps.length || !orderedStepIds.every((id) => ids.has(id))) {
    throw new ApiError(400, "VALIDATION_ERROR", "The step order must list every step of this template exactly once");
  }

  await prisma.$transaction(async (tx) => {
    const OFFSET = 1000;
    for (let i = 0; i < orderedStepIds.length; i++) {
      await tx.templateStep.update({ where: { id: orderedStepIds[i] }, data: { orderIndex: OFFSET + i } });
    }
    for (let i = 0; i < orderedStepIds.length; i++) {
      await tx.templateStep.update({ where: { id: orderedStepIds[i] }, data: { orderIndex: i + 1 } });
    }
  });

  return getTemplateDetail(prisma, templateId);
}

export type CreateTemplateInput = {
  subjectId: string;
  track: Track;
  title: string;
  description: string;
};

// SPEC.md §5.8: POST /teacher/templates.
export async function createTemplate(prisma: PrismaClient, authorId: string, input: CreateTemplateInput) {
  const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
  if (!subject) {
    throw new ApiError(404, "NOT_FOUND", "Subject not found");
  }

  return prisma.roadmapTemplate.create({
    data: {
      subjectId: input.subjectId,
      track: input.track,
      title: input.title,
      description: input.description,
      authorId,
      isPublished: false,
    },
  });
}

// SPEC.md §2.3 + this prompt: a template can only be published once it has at
// least one step, and every quiz step has at least one question.
export async function publishTemplate(prisma: PrismaClient, templateId: string) {
  const template = await prisma.roadmapTemplate.findUnique({
    where: { id: templateId },
    include: { steps: { include: { questions: true } } },
  });
  if (!template) {
    throw new ApiError(404, "NOT_FOUND", "Template not found");
  }

  if (template.steps.length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "A template must have at least one step before it can be published");
  }
  const quizStepsWithoutQuestions = template.steps.filter((s) => s.type === "quiz" && s.questions.length === 0);
  if (quizStepsWithoutQuestions.length > 0) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `Every quiz step needs at least one question (missing on: ${quizStepsWithoutQuestions.map((s) => s.title).join(", ")})`
    );
  }

  // Pre-check for a friendlier error; the partial unique index from Prompt 1
  // (one published template per subject+track) is the real guarantee against
  // a race between two concurrent publish requests.
  const conflictingPublished = await prisma.roadmapTemplate.findFirst({
    where: { subjectId: template.subjectId, track: template.track, isPublished: true, NOT: { id: template.id } },
  });
  if (conflictingPublished) {
    throw new ApiError(400, "VALIDATION_ERROR", "A published template already exists for this subject and track");
  }

  try {
    return await prisma.roadmapTemplate.update({ where: { id: templateId }, data: { isPublished: true } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(400, "VALIDATION_ERROR", "A published template already exists for this subject and track");
    }
    throw e;
  }
}

export type AddTemplateStepInput = {
  orderIndex: number;
  title: string;
  description: string;
  type: StepType;
  passScore?: number;
  maxAttempts?: number | null;
  estimatedMinutes: number;
};

// SPEC.md §5.8: POST /teacher/templates/:id/steps.
export async function addTemplateStep(prisma: PrismaClient, templateId: string, input: AddTemplateStepInput) {
  const template = await prisma.roadmapTemplate.findUnique({ where: { id: templateId } });
  if (!template) {
    throw new ApiError(404, "NOT_FOUND", "Template not found");
  }

  try {
    return await prisma.templateStep.create({
      data: {
        templateId,
        orderIndex: input.orderIndex,
        title: input.title,
        description: input.description,
        type: input.type,
        passScore: input.passScore ?? 60,
        maxAttempts: input.maxAttempts === undefined ? 3 : input.maxAttempts,
        estimatedMinutes: input.estimatedMinutes,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(400, "VALIDATION_ERROR", `A step with order_index ${input.orderIndex} already exists`);
    }
    throw e;
  }
}

export type UploadedFile = { buffer: Buffer; originalName: string };

// SPEC.md §5.8: POST /teacher/steps/:id/materials — same server-side size and
// content-sniffing rules as student submissions (§5.6), reused rather than
// duplicated.
export async function addMaterial(
  prisma: PrismaClient,
  storage: StorageDriver,
  uploadedById: string,
  templateStepId: string,
  file: UploadedFile
) {
  const templateStep = await prisma.templateStep.findUnique({ where: { id: templateStepId } });
  if (!templateStep) {
    throw new ApiError(404, "NOT_FOUND", "Step not found");
  }

  if (file.buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new ApiError(413, "FILE_TOO_LARGE", "File exceeds the 10 MB limit");
  }
  const mimeType = await sniffAllowedMimeType(file.buffer);
  if (!mimeType) {
    throw new ApiError(415, "UNSUPPORTED_FILE_TYPE", "This file type is not supported");
  }

  const key = `materials/${templateStepId}/${randomUUID()}-${sanitizeFileName(file.originalName)}`;
  await storage.upload({ key, body: file.buffer, contentType: mimeType });

  return prisma.stepMaterial.create({
    data: {
      templateStepId,
      fileKey: key,
      fileName: file.originalName,
      mimeType,
      sizeBytes: BigInt(file.buffer.byteLength),
      uploadedById,
    },
  });
}

export type AddQuestionInput = {
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

// SPEC.md §5.8: POST /teacher/steps/:id/questions. order_index isn't part of
// the request body (unlike template steps), so it's auto-assigned as the
// next available slot for this step.
export async function addQuestion(prisma: PrismaClient, templateStepId: string, input: AddQuestionInput) {
  const templateStep = await prisma.templateStep.findUnique({ where: { id: templateStepId } });
  if (!templateStep) {
    throw new ApiError(404, "NOT_FOUND", "Step not found");
  }
  if (templateStep.type !== "quiz") {
    throw new ApiError(400, "WRONG_STEP_TYPE", "This step is not a quiz");
  }

  const last = await prisma.question.findFirst({
    where: { templateStepId },
    orderBy: { orderIndex: "desc" },
  });
  const orderIndex = (last?.orderIndex ?? 0) + 1;

  return prisma.question.create({
    data: {
      templateStepId,
      orderIndex,
      text: input.text,
      options: input.options,
      correctIndex: input.correctIndex,
      explanation: input.explanation,
    },
  });
}
