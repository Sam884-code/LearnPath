import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient, StepType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { submitQuiz } from "./submitQuiz";
import { TEST_DB_URL } from "../../tests/test-db-config";

const prisma = new PrismaClient({ datasourceUrl: TEST_DB_URL });

afterAll(async () => {
  await prisma.$disconnect();
});

async function createUser(role: "student" | "teacher") {
  const suffix = randomUUID();
  return prisma.user.create({
    data: { name: `Test ${role}`, email: `${role}-${suffix}@test.local`, passwordHash: "x", role },
  });
}

// Quiz step has 2 questions (q1 correct=index 1, q2 correct=index 1),
// pass_score 60, max_attempts 2 — small enough to exhaust attempts quickly.
// Optionally followed by a second (lesson) step, to test advancing.
async function createFixture(
  opts: { secondStep?: boolean; secondStepType?: StepType; maxAttempts?: number | null } = {}
) {
  const teacher = await createUser("teacher");
  const student = await createUser("student");
  const suffix = randomUUID();

  const subject = await prisma.subject.create({ data: { title: "Subj", slug: `subj-${suffix}` } });
  const template = await prisma.roadmapTemplate.create({
    data: {
      subjectId: subject.id,
      track: "exam",
      title: "T",
      description: "T",
      authorId: teacher.id,
      isPublished: true,
    },
  });

  const quizStep = await prisma.templateStep.create({
    data: {
      templateId: template.id,
      orderIndex: 1,
      title: "Quiz Step",
      description: "d",
      type: "quiz" as StepType,
      passScore: 60,
      maxAttempts: opts.maxAttempts === undefined ? 2 : opts.maxAttempts,
      estimatedMinutes: 15,
    },
  });
  const q1 = await prisma.question.create({
    data: {
      templateStepId: quizStep.id,
      orderIndex: 1,
      text: "2 + 2 = ?",
      options: ["3", "4", "5", "6"],
      correctIndex: 1,
      explanation: "2 + 2 = 4",
    },
  });
  const q2 = await prisma.question.create({
    data: {
      templateStepId: quizStep.id,
      orderIndex: 2,
      text: "3 + 3 = ?",
      options: ["5", "6", "7", "8"],
      correctIndex: 1,
      explanation: "3 + 3 = 6",
    },
  });

  if (opts.secondStep) {
    await prisma.templateStep.create({
      data: {
        templateId: template.id,
        orderIndex: 2,
        title: "Second Step",
        description: "d",
        type: opts.secondStepType ?? "lesson",
        estimatedMinutes: 10,
      },
    });
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      userId: student.id,
      subjectId: subject.id,
      templateId: template.id,
      track: "exam",
      pace: "normal",
      wantsMentorQa: false,
      rawAnswers: {},
      startedAt: new Date(),
    },
  });

  const userStep = await prisma.userStep.create({
    data: {
      enrollmentId: enrollment.id,
      templateStepId: quizStep.id,
      orderIndex: 1,
      status: "active",
      activatedAt: new Date(),
    },
  });

  let nextUserStep = null;
  if (opts.secondStep) {
    const lessonTemplateStep = await prisma.templateStep.findFirstOrThrow({
      where: { templateId: template.id, orderIndex: 2 },
    });
    nextUserStep = await prisma.userStep.create({
      data: {
        enrollmentId: enrollment.id,
        templateStepId: lessonTemplateStep.id,
        orderIndex: 2,
        status: "locked",
      },
    });
  }

  return { student, enrollment, userStep, nextUserStep, q1, q2 };
}

function correctAnswers(q1Id: string, q2Id: string) {
  return [
    { question_id: q1Id, chosen_index: 1 },
    { question_id: q2Id, chosen_index: 1 },
  ];
}
function wrongAnswers(q1Id: string, q2Id: string) {
  return [
    { question_id: q1Id, chosen_index: 0 },
    { question_id: q2Id, chosen_index: 0 },
  ];
}

describe("submitQuiz", () => {
  test("passing submits advances the step and returns next_step", async () => {
    const { student, userStep, nextUserStep, q1, q2 } = await createFixture({ secondStep: true });

    const result = await submitQuiz(prisma, student.id, userStep.id, correctAnswers(q1.id, q2.id));

    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.next_step?.id).toBe(nextUserStep!.id);
    expect(result.next_step?.status).toBe("active");
    expect(result.enrollment_finished).toBe(false);

    const stored = await prisma.userStep.findUniqueOrThrow({ where: { id: userStep.id } });
    expect(stored.status).toBe("done");
    const attempts = await prisma.quizAttempt.findMany({ where: { userStepId: userStep.id } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].passed).toBe(true);
  });

  test("passing the last step finishes the enrollment", async () => {
    const { student, enrollment, userStep, q1, q2 } = await createFixture({ secondStep: false });

    const result = await submitQuiz(prisma, student.id, userStep.id, correctAnswers(q1.id, q2.id));

    expect(result.next_step).toBeNull();
    expect(result.enrollment_finished).toBe(true);

    const storedEnrollment = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
    expect(storedEnrollment.completedAt).not.toBeNull();
  });

  // SPEC.md §4: "Quiz failed → Step stays active. attempts += 1. Show which
  // questions were wrong + explanations. Retry allowed immediately."
  test("failing a quiz: step stays active, attempts increments, wrong answers explained, retry allowed", async () => {
    const { student, userStep, q1, q2 } = await createFixture();

    const result = await submitQuiz(prisma, student.id, userStep.id, wrongAnswers(q1.id, q2.id));

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.attempts).toBe(1);
    expect(result.attempts_left).toBe(1);
    expect(result.next_step).toBeNull();

    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ question_id: q1.id, correct: false, correct_index: 1, explanation: "2 + 2 = 4" }),
        expect.objectContaining({ question_id: q2.id, correct: false, correct_index: 1, explanation: "3 + 3 = 6" }),
      ])
    );

    const stored = await prisma.userStep.findUniqueOrThrow({ where: { id: userStep.id } });
    expect(stored.status).toBe("active"); // never locked out
    expect(stored.attempts).toBe(1);

    // Retry allowed immediately, and this time it passes.
    const retry = await submitQuiz(prisma, student.id, userStep.id, correctAnswers(q1.id, q2.id));
    expect(retry.passed).toBe(true);
    expect(retry.attempts).toBe(2);
  });

  // SPEC.md §4: "Attempts exhausted → Step stays active. Quiz submit returns
  // NO_ATTEMPTS_LEFT. Never hard-lock the student out."
  test("attempts exhausted returns NO_ATTEMPTS_LEFT and records no new attempt", async () => {
    const { student, userStep, q1, q2 } = await createFixture({ maxAttempts: 2 });

    await submitQuiz(prisma, student.id, userStep.id, wrongAnswers(q1.id, q2.id)); // attempt 1
    await submitQuiz(prisma, student.id, userStep.id, wrongAnswers(q1.id, q2.id)); // attempt 2, exhausts

    await expect(
      submitQuiz(prisma, student.id, userStep.id, correctAnswers(q1.id, q2.id))
    ).rejects.toMatchObject({ code: "NO_ATTEMPTS_LEFT" });

    const stored = await prisma.userStep.findUniqueOrThrow({ where: { id: userStep.id } });
    expect(stored.status).toBe("active"); // never hard-locked
    expect(stored.attempts).toBe(2); // the rejected 3rd call did not record an attempt

    const attempts = await prisma.quizAttempt.findMany({ where: { userStepId: userStep.id } });
    expect(attempts).toHaveLength(2);
  });

  test("unlimited attempts (max_attempts null) never returns NO_ATTEMPTS_LEFT", async () => {
    const { student, userStep, q1, q2 } = await createFixture({ maxAttempts: null });

    for (let i = 0; i < 5; i++) {
      const result = await submitQuiz(prisma, student.id, userStep.id, wrongAnswers(q1.id, q2.id));
      expect(result.attempts_left).toBeNull();
    }

    const stored = await prisma.userStep.findUniqueOrThrow({ where: { id: userStep.id } });
    expect(stored.attempts).toBe(5);
    expect(stored.status).toBe("active");
  });

  test("a non-quiz step returns WRONG_STEP_TYPE", async () => {
    const { student, userStep } = await createFixture();
    // Mutate the template step's type to something else to exercise the guard.
    await prisma.templateStep.update({
      where: { id: userStep.templateStepId },
      data: { type: "lesson" },
    });

    await expect(
      submitQuiz(prisma, student.id, userStep.id, [{ question_id: randomUUID(), chosen_index: 0 }])
    ).rejects.toMatchObject({ code: "WRONG_STEP_TYPE" });
  });

  test("a locked step returns STEP_LOCKED", async () => {
    // secondStepType "quiz" so the type check passes and the locked check is
    // actually what's exercised (a locked lesson step would hit
    // WRONG_STEP_TYPE first, since that check runs before the lock check).
    const { student, nextUserStep } = await createFixture({ secondStep: true, secondStepType: "quiz" });

    await expect(
      submitQuiz(prisma, student.id, nextUserStep!.id, [{ question_id: randomUUID(), chosen_index: 0 }])
    ).rejects.toMatchObject({ code: "STEP_LOCKED" });
  });

  test("a different student gets FORBIDDEN", async () => {
    const { userStep, q1, q2 } = await createFixture();
    const otherStudent = await createUser("student");

    await expect(
      submitQuiz(prisma, otherStudent.id, userStep.id, correctAnswers(q1.id, q2.id))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
