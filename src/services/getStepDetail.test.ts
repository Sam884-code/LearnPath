import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient, UserStepStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { getStepDetail } from "./getStepDetail";
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

async function createFixture(status: UserStepStatus) {
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
      title: "Step 1",
      description: "Do the thing",
      type: "assignment",
      passScore: 70,
      maxAttempts: 3,
      estimatedMinutes: 30,
    },
  });
  await prisma.stepMaterial.create({
    data: {
      templateStepId: templateStep.id,
      fileKey: "materials/k1",
      fileName: "handout.pdf",
      mimeType: "application/pdf",
      sizeBytes: BigInt(2048),
      uploadedById: teacher.id,
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
      status,
      activatedAt: status !== "locked" ? new Date() : null,
    },
  });

  return { teacher, student, enrollment, templateStep, userStep };
}

describe("getStepDetail", () => {
  test("returns full detail with materials for the owning student", async () => {
    const { student, userStep } = await createFixture("active");

    const detail = await getStepDetail(prisma, student.id, userStep.id);

    expect(detail.title).toBe("Step 1");
    expect(detail.pass_score).toBe(70);
    expect(detail.max_attempts).toBe(3);
    expect(detail.enrollment_id).toBeTruthy();
    expect(detail.wants_mentor_qa).toBe(false);
    expect(detail.materials).toHaveLength(1);
    expect(detail.materials[0]).toMatchObject({ file_name: "handout.pdf", size_bytes: 2048 });
    expect(detail.materials[0].download_url).toContain(detail.materials[0].id);
    expect(detail.submission).toBeNull();
  });

  test("returns the most recent submission when several exist", async () => {
    const { student, userStep } = await createFixture("active");

    await prisma.submission.create({
      data: {
        userStepId: userStep.id,
        fileKey: "k1",
        fileName: "first.pdf",
        mimeType: "application/pdf",
        sizeBytes: BigInt(10),
        submittedAt: new Date(Date.now() - 60_000),
        grade: 40,
      },
    });
    const latest = await prisma.submission.create({
      data: {
        userStepId: userStep.id,
        fileKey: "k2",
        fileName: "second.pdf",
        mimeType: "application/pdf",
        sizeBytes: BigInt(20),
        submittedAt: new Date(),
      },
    });

    const detail = await getStepDetail(prisma, student.id, userStep.id);
    expect(detail.submission?.id).toBe(latest.id);
    expect(detail.submission?.file_name).toBe("second.pdf");
  });

  test("a locked step returns STEP_LOCKED", async () => {
    const { student, userStep } = await createFixture("locked");

    await expect(getStepDetail(prisma, student.id, userStep.id)).rejects.toMatchObject({
      code: "STEP_LOCKED",
    });
  });

  test("a different student gets FORBIDDEN, even for a locked step", async () => {
    const { userStep } = await createFixture("locked");
    const otherStudent = await createUser("student");

    await expect(getStepDetail(prisma, otherStudent.id, userStep.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
