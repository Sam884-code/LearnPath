import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";
import { logger } from "@/lib/logger";

// SPEC.md §11.3: teacher override to unblock a student who exhausted their quiz
// attempts. Resets `attempts` to 0 on an ACTIVE step only — it never touches
// `status`, so the one-active-step invariant is untouched.
export async function resetStepAttempts(prisma: PrismaClient, teacherId: string, userStepId: string) {
  const userStep = await prisma.userStep.findUnique({
    where: { id: userStepId },
    include: { templateStep: true },
  });

  if (!userStep) {
    throw new ApiError(404, "NOT_FOUND", "Step not found");
  }
  if (userStep.status !== "active") {
    throw new ApiError(409, "STEP_NOT_ACTIVE", "Attempts can only be reset on an active step");
  }

  const updated = await prisma.userStep.update({
    where: { id: userStepId },
    data: { attempts: 0 },
  });

  logger.info(
    { teacherId, userStepId, enrollmentId: userStep.enrollmentId },
    "teacher reset step attempts"
  );

  return {
    id: updated.id,
    attempts: updated.attempts,
    max_attempts: userStep.templateStep.maxAttempts,
    status: updated.status,
  };
}
