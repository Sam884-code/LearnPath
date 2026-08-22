import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { listStuckStudents } from "./stuckStudents";
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

async function createActiveStepFixture(opts: { maxAttempts: number | null; attempts: number }) {
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
      title: "Quiz",
      description: "d",
      type: "quiz",
      maxAttempts: opts.maxAttempts,
      estimatedMinutes: 10,
    },
  });
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
      status: "active",
      attempts: opts.attempts,
      activatedAt: new Date(),
    },
  });

  return { student, enrollment, userStep };
}

describe("listStuckStudents", () => {
  test("includes a student whose attempts have reached max_attempts", async () => {
    const { userStep } = await createActiveStepFixture({ maxAttempts: 3, attempts: 3 });

    const stuck = await listStuckStudents(prisma);
    expect(stuck.some((s) => s.step.id === userStep.id)).toBe(true);
  });

  test("excludes a student who hasn't reached max_attempts yet", async () => {
    const { userStep } = await createActiveStepFixture({ maxAttempts: 3, attempts: 1 });

    const stuck = await listStuckStudents(prisma);
    expect(stuck.some((s) => s.step.id === userStep.id)).toBe(false);
  });

  test("never includes a step with unlimited attempts (max_attempts null), no matter how many attempts", async () => {
    const { userStep } = await createActiveStepFixture({ maxAttempts: null, attempts: 50 });

    const stuck = await listStuckStudents(prisma);
    expect(stuck.some((s) => s.step.id === userStep.id)).toBe(false);
  });
});
