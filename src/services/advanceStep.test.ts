import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { advanceStep } from "./advanceStep";
import { ApiError } from "@/lib/errors";
import { TEST_DB_URL } from "../../tests/test-db-config";

const prisma = new PrismaClient({ datasourceUrl: TEST_DB_URL });

afterAll(async () => {
  await prisma.$disconnect();
});

// Builds a fresh teacher + student + published template + enrollment, with
// `stepCount` user_steps (step 1 active, the rest locked). Each fixture uses
// unique emails/slugs so tests don't collide with each other.
async function createFixture(stepCount: number) {
  const suffix = randomUUID();

  const teacher = await prisma.user.create({
    data: { name: "Test Teacher", email: `teacher-${suffix}@test.local`, passwordHash: "x", role: "teacher" },
  });
  const student = await prisma.user.create({
    data: { name: "Test Student", email: `student-${suffix}@test.local`, passwordHash: "x", role: "student" },
  });
  const subject = await prisma.subject.create({
    data: { title: "Test Subject", slug: `subject-${suffix}` },
  });
  const template = await prisma.roadmapTemplate.create({
    data: {
      subjectId: subject.id,
      track: "exam",
      title: "Test Template",
      description: "Test",
      authorId: teacher.id,
      isPublished: true,
    },
  });

  const templateSteps = [];
  for (let i = 1; i <= stepCount; i++) {
    templateSteps.push(
      await prisma.templateStep.create({
        data: {
          templateId: template.id,
          orderIndex: i,
          title: `Step ${i}`,
          description: "Test step",
          type: "lesson",
          estimatedMinutes: 10,
        },
      })
    );
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

  const userSteps = [];
  for (const ts of templateSteps) {
    userSteps.push(
      await prisma.userStep.create({
        data: {
          enrollmentId: enrollment.id,
          templateStepId: ts.id,
          orderIndex: ts.orderIndex,
          status: ts.orderIndex === 1 ? "active" : "locked",
          activatedAt: ts.orderIndex === 1 ? new Date() : null,
        },
      })
    );
  }

  return { enrollment, userSteps };
}

describe("advanceStep", () => {
  test("normal advance: step 1 done -> step 2 active", async () => {
    const { userSteps } = await createFixture(3);

    const result = await advanceStep(prisma, userSteps[0].id);

    expect(result.completed.status).toBe("done");
    expect(result.completed.completedAt).not.toBeNull();
    expect(result.next?.id).toBe(userSteps[1].id);
    expect(result.next?.status).toBe("active");
    expect(result.enrollment_finished).toBe(false);

    const step2 = await prisma.userStep.findUniqueOrThrow({ where: { id: userSteps[1].id } });
    expect(step2.status).toBe("active");
    expect(step2.activatedAt).not.toBeNull();

    const step3 = await prisma.userStep.findUniqueOrThrow({ where: { id: userSteps[2].id } });
    expect(step3.status).toBe("locked");
  });

  test("last step: enrollment gets completed_at, no next step", async () => {
    const { enrollment, userSteps } = await createFixture(1);

    const result = await advanceStep(prisma, userSteps[0].id);

    expect(result.next).toBeNull();
    expect(result.enrollment_finished).toBe(true);

    const refetched = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
    expect(refetched.completedAt).not.toBeNull();
  });

  test("advancing a locked step throws STEP_NOT_ACTIVE", async () => {
    const { userSteps } = await createFixture(3);

    await expect(advanceStep(prisma, userSteps[1].id)).rejects.toMatchObject({
      code: "STEP_NOT_ACTIVE",
    });
  });

  test("advancing an already-done step throws STEP_NOT_ACTIVE", async () => {
    const { userSteps } = await createFixture(3);

    await advanceStep(prisma, userSteps[0].id);

    await expect(advanceStep(prisma, userSteps[0].id)).rejects.toMatchObject({
      code: "STEP_NOT_ACTIVE",
    });
  });

  test("two concurrent advanceStep calls on the same step: exactly one succeeds", async () => {
    const { enrollment, userSteps } = await createFixture(3);

    // Both calls are issued before either is awaited, so they race as two
    // genuinely concurrent transactions against the same row.
    const results = await Promise.allSettled([
      advanceStep(prisma, userSteps[0].id),
      advanceStep(prisma, userSteps[0].id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ApiError);
    expect(rejected[0].reason.code).toBe("STEP_NOT_ACTIVE");

    const activeSteps = await prisma.userStep.findMany({
      where: { enrollmentId: enrollment.id, status: "active" },
    });
    expect(activeSteps).toHaveLength(1);
    expect(activeSteps[0].id).toBe(userSteps[1].id);

    const doneSteps = await prisma.userStep.findMany({
      where: { enrollmentId: enrollment.id, status: "done" },
    });
    expect(doneSteps).toHaveLength(1);
    expect(doneSteps[0].id).toBe(userSteps[0].id);
  });
});
