import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createEnrollment } from "./createEnrollment";
import { TEST_DB_URL } from "../../tests/test-db-config";

const prisma = new PrismaClient({ datasourceUrl: TEST_DB_URL });

afterAll(async () => {
  await prisma.$disconnect();
});

async function createTemplateFixture(estimatedMinutesPerStep: number[]) {
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

  for (let i = 0; i < estimatedMinutesPerStep.length; i++) {
    await prisma.templateStep.create({
      data: {
        templateId: template.id,
        orderIndex: i + 1,
        title: `Step ${i + 1}`,
        description: "Test step",
        type: "lesson",
        estimatedMinutes: estimatedMinutesPerStep[i],
      },
    });
  }

  return { student, subject, template };
}

function dateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

describe("createEnrollment", () => {
  test("enroll a seeded student: right number of user_steps, exactly one active, correct due-date spacing", async () => {
    // "normal" pace (from daily_hours "1to2"): divisor 60, minDays 2
    // step 1: ceil(30/60)=1  -> min 2   -> +2 days  -> cumulative 2
    // step 2: ceil(180/60)=3            -> +3 days  -> cumulative 5
    // step 3: ceil(60/60)=1  -> min 2   -> +2 days  -> cumulative 7
    const { student, subject } = await createTemplateFixture([30, 180, 60]);

    const result = await createEnrollment(prisma, {
      userId: student.id,
      subjectId: subject.id,
      track: "exam",
      dailyHours: "1to2",
      wantsMentorQa: true,
      rawAnswers: { subject_id: subject.id, note: "onboarding payload" },
    });

    expect(result.enrollment.pace).toBe("normal");

    const userSteps = await prisma.userStep.findMany({
      where: { enrollmentId: result.enrollment.id },
      orderBy: { orderIndex: "asc" },
    });

    expect(userSteps).toHaveLength(3);

    const activeSteps = userSteps.filter((s) => s.status === "active");
    expect(activeSteps).toHaveLength(1);
    expect(activeSteps[0].orderIndex).toBe(1);
    expect(activeSteps[0].activatedAt).not.toBeNull();

    expect(userSteps[1].status).toBe("locked");
    expect(userSteps[1].activatedAt).toBeNull();
    expect(userSteps[2].status).toBe("locked");

    const startedAt = result.enrollment.startedAt;
    const expectedCumulativeDays = [2, 5, 7];
    userSteps.forEach((step, i) => {
      const expected = new Date(startedAt);
      expected.setUTCDate(expected.getUTCDate() + expectedCumulativeDays[i]);
      expect(step.dueDate).not.toBeNull();
      expect(dateOnly(new Date(step.dueDate!))).toBe(dateOnly(expected));
    });

    const storedEnrollment = await prisma.enrollment.findUniqueOrThrow({ where: { id: result.enrollment.id } });
    expect(storedEnrollment.rawAnswers).toMatchObject({ note: "onboarding payload" });
  });

  test("returns NO_TEMPLATE_AVAILABLE when no published template exists for subject+track", async () => {
    const suffix = randomUUID();
    const student = await prisma.user.create({
      data: { name: "S", email: `s-${suffix}@test.local`, passwordHash: "x", role: "student" },
    });
    const subject = await prisma.subject.create({ data: { title: "Empty", slug: `empty-${suffix}` } });

    await expect(
      createEnrollment(prisma, {
        userId: student.id,
        subjectId: subject.id,
        track: "exam",
        dailyHours: "lt1",
        wantsMentorQa: false,
        rawAnswers: {},
      })
    ).rejects.toMatchObject({ code: "NO_TEMPLATE_AVAILABLE" });
  });

  test("returns ALREADY_ENROLLED for a second live enrollment in the same subject", async () => {
    const { student, subject } = await createTemplateFixture([30]);

    await createEnrollment(prisma, {
      userId: student.id,
      subjectId: subject.id,
      track: "exam",
      dailyHours: "lt1",
      wantsMentorQa: false,
      rawAnswers: {},
    });

    await expect(
      createEnrollment(prisma, {
        userId: student.id,
        subjectId: subject.id,
        track: "exam",
        dailyHours: "lt1",
        wantsMentorQa: false,
        rawAnswers: {},
      })
    ).rejects.toMatchObject({ code: "ALREADY_ENROLLED" });
  });
});
