import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient, StepType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { getQuiz } from "./getQuiz";
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

async function createFixture(status: "locked" | "active" | "done", type: StepType = "quiz") {
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
  const templateStep = await prisma.templateStep.create({
    data: {
      templateId: template.id,
      orderIndex: 1,
      title: "Quiz Step",
      description: "d",
      type,
      passScore: 60,
      maxAttempts: 3,
      estimatedMinutes: 15,
    },
  });

  if (type === "quiz") {
    await prisma.question.create({
      data: {
        templateStepId: templateStep.id,
        orderIndex: 1,
        text: "2 + 2 = ?",
        options: ["3", "4", "5", "6"],
        correctIndex: 1,
        explanation: "2 + 2 = 4",
      },
    });
    await prisma.question.create({
      data: {
        templateStepId: templateStep.id,
        orderIndex: 2,
        text: "3 + 3 = ?",
        options: ["5", "6", "7", "8"],
        correctIndex: 1,
        explanation: "3 + 3 = 6",
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
      templateStepId: templateStep.id,
      orderIndex: 1,
      status,
      activatedAt: status !== "locked" ? new Date() : null,
    },
  });

  return { student, userStep };
}

describe("getQuiz", () => {
  test("never includes correct_index in the response body", async () => {
    const { student, userStep } = await createFixture("active");

    const quiz = await getQuiz(prisma, student.id, userStep.id);

    expect(JSON.stringify(quiz)).not.toContain("correct_index");
    // Also guard against a differently-cased/camelCase leak of the same field.
    expect(JSON.stringify(quiz)).not.toContain("correctIndex");
  });

  test("returns questions with only the safe fields", async () => {
    const { student, userStep } = await createFixture("active");

    const quiz = await getQuiz(prisma, student.id, userStep.id);

    expect(quiz.pass_score).toBe(60);
    expect(quiz.max_attempts).toBe(3);
    expect(quiz.questions).toHaveLength(2);
    expect(Object.keys(quiz.questions[0]).sort()).toEqual(["id", "options", "order_index", "text"].sort());
  });

  test("a non-quiz step returns WRONG_STEP_TYPE", async () => {
    const { student, userStep } = await createFixture("active", "lesson");

    await expect(getQuiz(prisma, student.id, userStep.id)).rejects.toMatchObject({
      code: "WRONG_STEP_TYPE",
    });
  });

  test("a locked step returns STEP_LOCKED", async () => {
    const { student, userStep } = await createFixture("locked");

    await expect(getQuiz(prisma, student.id, userStep.id)).rejects.toMatchObject({
      code: "STEP_LOCKED",
    });
  });
});
