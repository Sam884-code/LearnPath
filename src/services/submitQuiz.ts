import { Prisma, PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";
import { serializeUserStepSummary } from "@/lib/serialize";
import { advanceStepTx, LockedUserStepRow } from "./advanceStep";

export type QuizAnswer = { question_id: string; chosen_index: number };

// SPEC.md §5.5 + §4's edge-case table.
export async function submitQuiz(prisma: PrismaClient, userId: string, stepId: string, answers: QuizAnswer[]) {
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
    throw new ApiError(403, "FORBIDDEN", "You can only submit your own steps");
  }
  if (userStep.templateStep.type !== "quiz") {
    throw new ApiError(400, "WRONG_STEP_TYPE", "This step is not a quiz");
  }
  if (userStep.status === "locked") {
    throw new ApiError(403, "STEP_LOCKED", "Step is not yet unlocked");
  }

  const questions = userStep.templateStep.questions;
  const maxAttempts = userStep.templateStep.maxAttempts;
  const passScore = userStep.templateStep.passScore;

  const chosenByQuestionId = new Map(answers.map((a) => [a.question_id, a.chosen_index]));
  const correctCount = questions.filter((q) => chosenByQuestionId.get(q.id) === q.correctIndex).length;
  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= passScore;

  return prisma.$transaction(async (tx) => {
    // Lock the row before checking attempts, so two concurrent submits can't
    // both read a stale attempts count and both slip past the max-attempts
    // check — the same race the partial unique index in Prompt 1 and the
    // FOR UPDATE lock in advanceStep both exist to prevent.
    const rows = await tx.$queryRaw<LockedUserStepRow[]>`
      SELECT * FROM "user_steps" WHERE "id" = ${stepId}::uuid FOR UPDATE
    `;
    const row = rows[0];

    // Re-validate under the lock in case another request changed the
    // step's state between the pre-checks above and acquiring this lock.
    if (!row || row.status === "locked") {
      throw new ApiError(403, "STEP_LOCKED", "Step is not yet unlocked");
    }
    if (row.status === "done") {
      throw new ApiError(409, "STEP_NOT_ACTIVE", "This step is already done");
    }

    if (maxAttempts !== null && row.attempts >= maxAttempts) {
      // Do NOT record an attempt for a rejected submission.
      throw new ApiError(409, "NO_ATTEMPTS_LEFT", "No attempts remaining for this quiz");
    }

    const attemptNumber = row.attempts + 1;

    await tx.quizAttempt.create({
      data: {
        userStepId: stepId,
        attemptNumber,
        answers: answers as unknown as Prisma.InputJsonValue,
        score,
        passed,
      },
    });

    await tx.userStep.update({
      where: { id: stepId },
      data: { attempts: attemptNumber, score },
    });

    const results = questions.map((q) => ({
      question_id: q.id,
      correct: chosenByQuestionId.get(q.id) === q.correctIndex,
      correct_index: q.correctIndex,
      explanation: q.explanation,
    }));

    const attemptsLeft = maxAttempts === null ? null : Math.max(maxAttempts - attemptNumber, 0);

    if (!passed) {
      // Step stays active; retry is allowed immediately (no lockout here).
      return {
        score,
        passed,
        attempts: attemptNumber,
        attempts_left: attemptsLeft,
        results,
        next_step: null,
        enrollment_finished: false,
      };
    }

    const advanced = await advanceStepTx(tx, row);
    const nextTemplateStep = advanced.next
      ? await tx.templateStep.findUniqueOrThrow({ where: { id: advanced.next.templateStepId } })
      : null;

    return {
      score,
      passed,
      attempts: attemptNumber,
      attempts_left: attemptsLeft,
      results,
      next_step:
        advanced.next && nextTemplateStep ? serializeUserStepSummary(advanced.next, nextTemplateStep) : null,
      enrollment_finished: advanced.enrollment_finished,
    };
  });
}
