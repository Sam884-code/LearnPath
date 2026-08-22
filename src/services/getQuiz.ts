import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";

// SPEC.md §5.5: GET /steps/:id/quiz.
// Absolute requirement: correct_index must never appear in this response —
// only fields safe to show before an attempt is submitted are selected here.
export async function getQuiz(prisma: PrismaClient, userId: string, stepId: string) {
  const userStep = await prisma.userStep.findUnique({
    where: { id: stepId },
    include: {
      enrollment: true,
      templateStep: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
    },
  });

  if (!userStep) {
    throw new ApiError(404, "NOT_FOUND", "Step not found");
  }
  if (userStep.enrollment.userId !== userId) {
    throw new ApiError(403, "FORBIDDEN", "You can only view your own steps");
  }
  if (userStep.templateStep.type !== "quiz") {
    throw new ApiError(400, "WRONG_STEP_TYPE", "This step is not a quiz");
  }
  if (userStep.status === "locked") {
    throw new ApiError(403, "STEP_LOCKED", "Step is not yet unlocked");
  }

  return {
    questions: userStep.templateStep.questions.map((q) => ({
      id: q.id,
      order_index: q.orderIndex,
      text: q.text,
      options: q.options,
    })),
    pass_score: userStep.templateStep.passScore,
    attempts: userStep.attempts,
    max_attempts: userStep.templateStep.maxAttempts,
  };
}
