import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";
import { advanceStep } from "./advanceStep";

// SPEC.md §5.8 / §13: GET /teacher/submissions?status=pending.
// "pending" (grade IS NULL) is the only status value the spec documents.
// Scoped to the grading teacher's classroom: only submissions from students who
// have joined this teacher's class are returned.
export async function listPendingSubmissions(prisma: PrismaClient, teacherId: string) {
  const submissions = await prisma.submission.findMany({
    where: {
      grade: null,
      userStep: {
        enrollment: {
          user: {
            classroomMemberships: { some: { classroom: { teacherId } } },
          },
        },
      },
    },
    include: {
      userStep: { include: { enrollment: { include: { user: true } }, templateStep: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  return submissions.map((s) => ({
    id: s.id,
    file_name: s.fileName,
    submitted_at: s.submittedAt,
    student: { id: s.userStep.enrollment.user.id, name: s.userStep.enrollment.user.name },
    step: { id: s.userStep.id, title: s.userStep.templateStep.title },
  }));
}

// SPEC.md §5.8: POST /teacher/submissions/:id/grade — must reuse advanceStep,
// not reimplement the completion transition.
export async function gradeSubmission(
  prisma: PrismaClient,
  graderId: string,
  submissionId: string,
  grade: number,
  feedback: string | null
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { userStep: { include: { templateStep: true } } },
  });
  if (!submission) {
    throw new ApiError(404, "NOT_FOUND", "Submission not found");
  }

  const updated = await prisma.submission.update({
    where: { id: submissionId },
    data: { grade, feedback, gradedById: graderId, gradedAt: new Date() },
  });

  // Only advance if this step is still the one actively awaiting this grade —
  // grading an older submission from before a resubmission (submission
  // history, per SPEC.md §4) must not try to re-advance an already-done step.
  const shouldAdvance = grade >= submission.userStep.templateStep.passScore && submission.userStep.status === "active";

  if (shouldAdvance) {
    const result = await advanceStep(prisma, submission.userStepId);
    return {
      submission: { id: updated.id, grade: updated.grade, feedback: updated.feedback, graded_at: updated.gradedAt },
      advanced: true,
      enrollment_finished: result.enrollment_finished,
    };
  }

  return {
    submission: { id: updated.id, grade: updated.grade, feedback: updated.feedback, graded_at: updated.gradedAt },
    advanced: false,
  };
}
