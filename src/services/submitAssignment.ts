import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";
import { sniffAllowedMimeType } from "@/lib/fileSniff";
import { sanitizeFileName } from "@/lib/sanitizeFileName";
import { serializeSubmission, serializeUserStepSummary } from "@/lib/serialize";
import type { StorageDriver } from "@/lib/storage/types";
import { advanceStep } from "./advanceStep";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export type UploadedFile = {
  buffer: Buffer;
  originalName: string;
};

// SPEC.md §5.6: POST /steps/:id/submissions.
export async function submitAssignment(
  prisma: PrismaClient,
  storage: StorageDriver,
  userId: string,
  stepId: string,
  file: UploadedFile
) {
  const userStep = await prisma.userStep.findUnique({
    where: { id: stepId },
    include: { enrollment: true, templateStep: true },
  });

  if (!userStep) {
    throw new ApiError(404, "NOT_FOUND", "Step not found");
  }
  if (userStep.enrollment.userId !== userId) {
    throw new ApiError(403, "FORBIDDEN", "You can only submit your own steps");
  }
  if (userStep.templateStep.type !== "assignment") {
    throw new ApiError(400, "WRONG_STEP_TYPE", "This step is not an assignment");
  }
  if (userStep.status === "locked") {
    throw new ApiError(403, "STEP_LOCKED", "Step is not yet unlocked");
  }
  if (userStep.status === "done") {
    throw new ApiError(409, "STEP_NOT_ACTIVE", "This step is already done");
  }

  // Enforced server-side, never trusting the client's declared size or
  // Content-Type — this is the actual received byte length, and mimeType
  // below comes from sniffing real file content, not `file.type`.
  if (file.buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new ApiError(413, "FILE_TOO_LARGE", "File exceeds the 10 MB limit");
  }

  const mimeType = await sniffAllowedMimeType(file.buffer);
  if (!mimeType) {
    throw new ApiError(415, "UNSUPPORTED_FILE_TYPE", "This file type is not supported");
  }

  const key = `submissions/${stepId}/${randomUUID()}-${sanitizeFileName(file.originalName)}`;
  await storage.upload({ key, body: file.buffer, contentType: mimeType });

  const submission = await prisma.submission.create({
    data: {
      userStepId: stepId,
      fileKey: key,
      fileName: file.originalName,
      mimeType,
      sizeBytes: BigInt(file.buffer.byteLength),
      submittedAt: new Date(),
    },
  });

  // SPEC.md: pass_score = 0 means "any submission counts as complete" —
  // advance immediately. Otherwise the step stays active/awaiting_review
  // until a teacher grades it.
  if (userStep.templateStep.passScore === 0) {
    const result = await advanceStep(prisma, stepId);
    return {
      submission: serializeSubmission(submission),
      step: serializeUserStepSummary(result.completed, userStep.templateStep),
    };
  }

  return {
    submission: serializeSubmission(submission),
    step: serializeUserStepSummary(userStep, userStep.templateStep),
  };
}
