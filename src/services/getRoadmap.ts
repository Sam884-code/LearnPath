import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";
import { isOverdue } from "@/lib/roadmap";
import { serializeSubject } from "@/lib/serialize";

// SPEC.md §5.4: GET /enrollments/:id/roadmap
export async function getRoadmap(prisma: PrismaClient, userId: string, enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      subject: true,
      userSteps: {
        orderBy: { orderIndex: "asc" },
        include: {
          templateStep: true,
          // Only need existence of an ungraded submission, per this prompt's
          // exact definition of awaiting_review.
          submissions: { where: { grade: null } },
        },
      },
    },
  });

  if (!enrollment) {
    throw new ApiError(404, "NOT_FOUND", "Enrollment not found");
  }
  if (enrollment.userId !== userId) {
    throw new ApiError(403, "FORBIDDEN", "You can only view your own roadmap");
  }

  const total = enrollment.userSteps.length;
  const done = enrollment.userSteps.filter((s) => s.status === "done").length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const activeStep = enrollment.userSteps.find((s) => s.status === "active");

  return {
    enrollment: {
      id: enrollment.id,
      subject: serializeSubject(enrollment.subject),
      track: enrollment.track,
      pace: enrollment.pace,
      completed_at: enrollment.completedAt,
    },
    progress: { done, total, percent, active_step_id: activeStep?.id ?? null },
    steps: enrollment.userSteps.map((s) => ({
      id: s.id,
      order_index: s.orderIndex,
      title: s.templateStep.title,
      type: s.templateStep.type,
      status: s.status,
      score: s.score,
      attempts: s.attempts,
      max_attempts: s.templateStep.maxAttempts,
      due_date: s.dueDate,
      overdue: isOverdue(s.dueDate, s.status),
      awaiting_review: s.templateStep.type === "assignment" && s.submissions.length > 0,
    })),
  };
}
