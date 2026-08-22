import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { getRoadmap } from "./getRoadmap";
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

async function createFixture() {
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

  const stepTypes: Array<"lesson" | "assignment"> = ["lesson", "assignment", "lesson"];
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

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  // step 1: lesson, done, due_date in the past -> must NOT count as overdue
  const step1 = await prisma.userStep.create({
    data: {
      enrollmentId: enrollment.id,
      templateStepId: templateSteps[0].id,
      orderIndex: 1,
      status: "done",
      dueDate: yesterday,
      completedAt: new Date(),
    },
  });

  // step 2: assignment, active, overdue, with an ungraded submission
  const step2 = await prisma.userStep.create({
    data: {
      enrollmentId: enrollment.id,
      templateStepId: templateSteps[1].id,
      orderIndex: 2,
      status: "active",
      dueDate: yesterday,
      activatedAt: new Date(),
    },
  });
  await prisma.submission.create({
    data: {
      userStepId: step2.id,
      fileKey: "k",
      fileName: "f.pdf",
      mimeType: "application/pdf",
      sizeBytes: BigInt(123),
      submittedAt: new Date(),
    },
  });

  // step 3: lesson, locked, due_date in the future
  const step3 = await prisma.userStep.create({
    data: {
      enrollmentId: enrollment.id,
      templateStepId: templateSteps[2].id,
      orderIndex: 3,
      status: "locked",
      dueDate: tomorrow,
    },
  });

  return { teacher, student, enrollment, steps: [step1, step2, step3] };
}

describe("getRoadmap", () => {
  test("progress, overdue, and awaiting_review are computed correctly", async () => {
    const { student, enrollment, steps } = await createFixture();

    const roadmap = await getRoadmap(prisma, student.id, enrollment.id);

    expect(roadmap.progress).toEqual({ done: 1, total: 3, percent: 33, active_step_id: steps[1].id });

    const [s1, s2, s3] = roadmap.steps;

    expect(s1.status).toBe("done");
    expect(s1.overdue).toBe(false); // done steps are never overdue, even with a past due_date

    expect(s2.status).toBe("active");
    expect(s2.overdue).toBe(true);
    expect(s2.awaiting_review).toBe(true);

    expect(s3.status).toBe("locked");
    expect(s3.overdue).toBe(false); // due_date is in the future
    expect(s3.awaiting_review).toBe(false);
  });

  test("a student reading another student's roadmap gets FORBIDDEN", async () => {
    const { enrollment } = await createFixture();
    const otherStudent = await createUser("student");

    await expect(getRoadmap(prisma, otherStudent.id, enrollment.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("a nonexistent enrollment returns NOT_FOUND", async () => {
    const student = await createUser("student");

    await expect(getRoadmap(prisma, student.id, randomUUID())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
