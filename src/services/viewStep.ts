import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";
import { serializeUserStepSummary } from "@/lib/serialize";
import { advanceStep } from "./advanceStep";

// SPEC.md §5.5: POST /steps/:id/view — precondition type=lesson, status=active.
export async function viewLessonStep(prisma: PrismaClient, userId: string, stepId: string) {
  const userStep = await prisma.userStep.findUnique({
    where: { id: stepId },
    include: { enrollment: true, templateStep: true },
  });

  if (!userStep) {
    throw new ApiError(404, "NOT_FOUND", "Step not found");
  }
  if (userStep.enrollment.userId !== userId) {
    throw new ApiError(403, "FORBIDDEN", "You can only complete your own steps");
  }
  if (userStep.templateStep.type !== "lesson") {
    throw new ApiError(400, "WRONG_STEP_TYPE", "This step is not a lesson");
  }
  if (userStep.status === "locked") {
    throw new ApiError(403, "STEP_LOCKED", "Step is not yet unlocked");
  }

  // Throws STEP_NOT_ACTIVE if the step is already done.
  const result = await advanceStep(prisma, stepId);

  const nextTemplateStep = result.next
    ? await prisma.templateStep.findUniqueOrThrow({ where: { id: result.next.templateStepId } })
    : null;

  return {
    step: serializeUserStepSummary(result.completed, userStep.templateStep),
    next_step:
      result.next && nextTemplateStep ? serializeUserStepSummary(result.next, nextTemplateStep) : null,
    enrollment_finished: result.enrollment_finished,
  };
}
