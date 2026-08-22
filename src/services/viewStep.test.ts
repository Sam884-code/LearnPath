import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient, StepType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { viewLessonStep } from "./viewStep";
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

async function createFixture(stepTypes: StepType[]) {
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

  const templateSteps = [];
  for (let i = 0; i < stepTypes.length; i++) {
    templateSteps.push(
      await prisma.templateStep.create({
        data: {
          templateId: template.id,
          orderIndex: i + 1,
          title: `Step ${i + 1}`,
          description: "d",
          type: stepTypes[i],
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

  return { student, enrollment, userSteps };
}

describe("viewLessonStep", () => {
  test("completes a lesson and activates the next step", async () => {
    const { student, userSteps } = await createFixture(["lesson", "lesson"]);

    const result = await viewLessonStep(prisma, student.id, userSteps[0].id);

    expect(result.step.status).toBe("done");
    expect(result.next_step?.id).toBe(userSteps[1].id);
    expect(result.next_step?.status).toBe("active");
    expect(result.enrollment_finished).toBe(false);
  });

  test("completing the last lesson finishes the enrollment", async () => {
    const { student, userSteps } = await createFixture(["lesson"]);

    const result = await viewLessonStep(prisma, student.id, userSteps[0].id);

    expect(result.next_step).toBeNull();
    expect(result.enrollment_finished).toBe(true);
  });

  test("a non-lesson step returns WRONG_STEP_TYPE", async () => {
    const { student, userSteps } = await createFixture(["quiz"]);

    await expect(viewLessonStep(prisma, student.id, userSteps[0].id)).rejects.toMatchObject({
      code: "WRONG_STEP_TYPE",
    });
  });

  test("a locked step returns STEP_LOCKED", async () => {
    const { student, userSteps } = await createFixture(["lesson", "lesson"]);

    await expect(viewLessonStep(prisma, student.id, userSteps[1].id)).rejects.toMatchObject({
      code: "STEP_LOCKED",
    });
  });

  test("an already-done step returns STEP_NOT_ACTIVE", async () => {
    const { student, userSteps } = await createFixture(["lesson"]);
    await viewLessonStep(prisma, student.id, userSteps[0].id);

    await expect(viewLessonStep(prisma, student.id, userSteps[0].id)).rejects.toMatchObject({
      code: "STEP_NOT_ACTIVE",
    });
  });
});
