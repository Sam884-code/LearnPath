import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";

function serializeMentorQuestion(q: {
  id: string;
  body: string;
  answer: string | null;
  answeredAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: q.id,
    body: q.body,
    answer: q.answer,
    answered_at: q.answeredAt,
    created_at: q.createdAt,
  };
}

// Ownership is checked before revealing whether mentor Q&A is even enabled,
// same "don't leak state to the wrong reader" principle used elsewhere.
async function requireOwnEnrollmentWithMentorQa(prisma: PrismaClient, userId: string, enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) {
    throw new ApiError(404, "NOT_FOUND", "Enrollment not found");
  }
  if (enrollment.userId !== userId) {
    throw new ApiError(403, "FORBIDDEN", "You can only use your own enrollment's mentor Q&A");
  }
  if (!enrollment.wantsMentorQa) {
    throw new ApiError(403, "FORBIDDEN", "Mentor Q&A is not enabled for this enrollment");
  }
  return enrollment;
}

// SPEC.md §5.7: POST /enrollments/:id/questions.
export async function askMentorQuestion(
  prisma: PrismaClient,
  userId: string,
  enrollmentId: string,
  body: string,
  userStepId: string | null
) {
  const enrollment = await requireOwnEnrollmentWithMentorQa(prisma, userId, enrollmentId);

  const question = await prisma.mentorQuestion.create({
    data: { enrollmentId: enrollment.id, userStepId, body },
  });
  return serializeMentorQuestion(question);
}

// SPEC.md §5.7: GET /enrollments/:id/questions.
export async function listMentorQuestions(prisma: PrismaClient, userId: string, enrollmentId: string) {
  const enrollment = await requireOwnEnrollmentWithMentorQa(prisma, userId, enrollmentId);

  const questions = await prisma.mentorQuestion.findMany({
    where: { enrollmentId: enrollment.id },
    orderBy: { createdAt: "asc" },
  });
  return questions.map(serializeMentorQuestion);
}

// GET /teacher/questions — the teacher's inbox. §6 lists a "Questions inbox"
// screen but §5.8's API omits a list endpoint (only answer); this fills that
// gap. `onlyUnanswered` backs the default inbox view.
export async function listQuestionsForTeacher(prisma: PrismaClient, onlyUnanswered: boolean) {
  const questions = await prisma.mentorQuestion.findMany({
    where: onlyUnanswered ? { answer: null } : undefined,
    orderBy: { createdAt: "asc" },
    include: {
      enrollment: { include: { user: true, subject: true } },
      userStep: { include: { templateStep: true } },
    },
  });

  return questions.map((q) => ({
    id: q.id,
    body: q.body,
    answer: q.answer,
    answered_at: q.answeredAt,
    created_at: q.createdAt,
    student: { id: q.enrollment.user.id, name: q.enrollment.user.name },
    subject: { id: q.enrollment.subject.id, title: q.enrollment.subject.title },
    step: q.userStep ? { id: q.userStep.id, title: q.userStep.templateStep.title } : null,
  }));
}

// SPEC.md §5.8: POST /teacher/questions/:id/answer.
export async function answerMentorQuestion(prisma: PrismaClient, teacherId: string, questionId: string, answer: string) {
  const question = await prisma.mentorQuestion.findUnique({ where: { id: questionId } });
  if (!question) {
    throw new ApiError(404, "NOT_FOUND", "Question not found");
  }

  const updated = await prisma.mentorQuestion.update({
    where: { id: questionId },
    data: { answer, answeredById: teacherId, answeredAt: new Date() },
  });
  return serializeMentorQuestion(updated);
}
