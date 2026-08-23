import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient, UserStepStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { resetStepAttempts } from "./resetStepAttempts";
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

async function createStuckStep(status: UserStepStatus, attempts: number) {
  const teacher = await createUser("teacher");
  const student = await createUser("student");
  const suffix = randomUUID();
  const subject = await prisma.subject.create({ data: { title: "S", slug: `s-${suffix}` } });
  const template = await prisma.roadmapTemplate.create({
    data: { subjectId: subject.id, track: "exam", title: "T", description: "d", authorId: teacher.id, isPublished: true },
  });
  const templateStep = await prisma.templateStep.create({
    data: { templateId: template.id, orderIndex: 1, title: "Quiz", description: "d", type: "quiz", maxAttempts: 3, estimatedMinutes: 10 },
  });
  const enrollment = await prisma.enrollment.create({
    data: { userId: student.id, subjectId: subject.id, templateId: template.id, track: "exam", pace: "normal", wantsMentorQa: false, rawAnswers: {}, startedAt: new Date() },
  });
  const userStep = await prisma.userStep.create({
    data: { enrollmentId: enrollment.id, templateStepId: templateStep.id, orderIndex: 1, status, attempts, activatedAt: status === "active" ? new Date() : null },
  });
  return { teacher, userStep };
}

describe("resetStepAttempts", () => {
  test("resets attempts to 0 on an active (stuck) step without changing status", async () => {
    const { teacher, userStep } = await createStuckStep("active", 3);

    const result = await resetStepAttempts(prisma, teacher.id, userStep.id);
    expect(result.attempts).toBe(0);
    expect(result.status).toBe("active");

    const stored = await prisma.userStep.findUniqueOrThrow({ where: { id: userStep.id } });
    expect(stored.attempts).toBe(0);
    expect(stored.status).toBe("active"); // one-active-step invariant untouched
  });

  test("refuses to reset a non-active step (STEP_NOT_ACTIVE)", async () => {
    const { teacher, userStep } = await createStuckStep("locked", 3);
    await expect(resetStepAttempts(prisma, teacher.id, userStep.id)).rejects.toMatchObject({
      code: "STEP_NOT_ACTIVE",
    });
  });

  test("returns NOT_FOUND for a nonexistent step", async () => {
    const teacher = await createUser("teacher");
    await expect(resetStepAttempts(prisma, teacher.id, randomUUID())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
