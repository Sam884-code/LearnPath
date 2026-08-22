import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";
import { isOverdue } from "@/lib/roadmap";

// SPEC.md §5.4: GET /steps/:id
export async function getStepDetail(prisma: PrismaClient, userId: string, stepId: string) {
  const userStep = await prisma.userStep.findUnique({
    where: { id: stepId },
    include: {
      enrollment: true,
      templateStep: { include: { materials: true } },
      // "submission" in the response is the most recent one — SPEC.md §4
      // implies a history of rows can accumulate (old kept, new inserted on
      // re-upload) but §5.4 only models a single object-or-null field.
      submissions: { orderBy: { submittedAt: "desc" }, take: 1 },
    },
  });

  if (!userStep) {
    throw new ApiError(404, "NOT_FOUND", "Step not found");
  }
  // Ownership is checked before revealing lock status, so an unauthorized
  // reader learns nothing about whether the step even exists for them.
  if (userStep.enrollment.userId !== userId) {
    throw new ApiError(403, "FORBIDDEN", "You can only view your own steps");
  }
  if (userStep.status === "locked") {
    throw new ApiError(403, "STEP_LOCKED", "Step is not yet unlocked");
  }

  const latestSubmission = userStep.submissions[0] ?? null;

  return {
    id: userStep.id,
    // Enrollment context so the step page can drive mentor Q&A (e.g. the quiz
    // "no attempts left" prompt) without a second round-trip. wants_mentor_qa
    // is the student's own onboarding answer, not sensitive data.
    enrollment_id: userStep.enrollmentId,
    wants_mentor_qa: userStep.enrollment.wantsMentorQa,
    title: userStep.templateStep.title,
    description: userStep.templateStep.description,
    type: userStep.templateStep.type,
    status: userStep.status,
    order_index: userStep.orderIndex,
    pass_score: userStep.templateStep.passScore,
    attempts: userStep.attempts,
    max_attempts: userStep.templateStep.maxAttempts,
    due_date: userStep.dueDate,
    overdue: isOverdue(userStep.dueDate, userStep.status),
    materials: userStep.templateStep.materials.map((m) => ({
      id: m.id,
      file_name: m.fileName,
      size_bytes: Number(m.sizeBytes),
      download_url: `/api/v1/materials/${m.id}/file`,
    })),
    submission: latestSubmission
      ? {
          id: latestSubmission.id,
          file_name: latestSubmission.fileName,
          submitted_at: latestSubmission.submittedAt,
          grade: latestSubmission.grade,
          feedback: latestSubmission.feedback,
        }
      : null,
  };
}
