import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient, StepType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { submitAssignment } from "./submitAssignment";
import { LocalStorageDriver } from "@/lib/storage/local";
import { TEST_DB_URL } from "../../tests/test-db-config";
import { PDF_BYTES, UNSUPPORTED_BYTES } from "../../tests/fixtures/files";

const prisma = new PrismaClient({ datasourceUrl: TEST_DB_URL });
const storage = new LocalStorageDriver();

afterAll(async () => {
  await prisma.$disconnect();
});

async function createUser(role: "student" | "teacher") {
  const suffix = randomUUID();
  return prisma.user.create({
    data: { name: `Test ${role}`, email: `${role}-${suffix}@test.local`, passwordHash: "x", role },
  });
}

async function createFixture(opts: { passScore: number; stepType?: StepType; status?: "locked" | "active" }) {
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
      title: "Assignment Step",
      description: "d",
      type: opts.stepType ?? "assignment",
      passScore: opts.passScore,
      estimatedMinutes: 30,
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

  const status = opts.status ?? "active";
  const userStep = await prisma.userStep.create({
    data: {
      enrollmentId: enrollment.id,
      templateStepId: templateStep.id,
      orderIndex: 1,
      status,
      activatedAt: status === "active" ? new Date() : null,
    },
  });

  return { student, enrollment, userStep };
}

describe("submitAssignment", () => {
  test("pass_score = 0: uploading advances the step immediately", async () => {
    const { student, enrollment, userStep } = await createFixture({ passScore: 0 });

    const result = await submitAssignment(prisma, storage, student.id, userStep.id, {
      buffer: PDF_BYTES,
      originalName: "homework.pdf",
    });

    expect(result.step.status).toBe("done");

    const stored = await prisma.userStep.findUniqueOrThrow({ where: { id: userStep.id } });
    expect(stored.status).toBe("done");

    const storedEnrollment = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
    expect(storedEnrollment.completedAt).not.toBeNull(); // it was the only step
  });

  test("pass_score > 0: uploading keeps the step active, awaiting review", async () => {
    const { student, userStep } = await createFixture({ passScore: 70 });

    const result = await submitAssignment(prisma, storage, student.id, userStep.id, {
      buffer: PDF_BYTES,
      originalName: "homework.pdf",
    });

    expect(result.step.status).toBe("active");

    const stored = await prisma.userStep.findUniqueOrThrow({ where: { id: userStep.id } });
    expect(stored.status).toBe("active");

    const submission = await prisma.submission.findFirstOrThrow({ where: { userStepId: userStep.id } });
    expect(submission.grade).toBeNull();
    expect(submission.mimeType).toBe("application/pdf");
  });

  test("a file over 10 MB is rejected with FILE_TOO_LARGE", async () => {
    const { student, userStep } = await createFixture({ passScore: 70 });
    const oversized = Buffer.concat([PDF_BYTES, Buffer.alloc(10 * 1024 * 1024)]);

    await expect(
      submitAssignment(prisma, storage, student.id, userStep.id, { buffer: oversized, originalName: "big.pdf" })
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  test("content that doesn't match an allowed type is rejected with UNSUPPORTED_FILE_TYPE, regardless of the declared name", async () => {
    const { student, userStep } = await createFixture({ passScore: 70 });

    await expect(
      submitAssignment(prisma, storage, student.id, userStep.id, {
        buffer: UNSUPPORTED_BYTES,
        originalName: "totally-a-pdf.pdf", // the lie the client tells; content is sniffed regardless
      })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FILE_TYPE" });
  });

  test("a non-assignment step returns WRONG_STEP_TYPE", async () => {
    const { student, userStep } = await createFixture({ passScore: 70, stepType: "lesson" });

    await expect(
      submitAssignment(prisma, storage, student.id, userStep.id, { buffer: PDF_BYTES, originalName: "f.pdf" })
    ).rejects.toMatchObject({ code: "WRONG_STEP_TYPE" });
  });

  test("a locked step returns STEP_LOCKED", async () => {
    const { student, userStep } = await createFixture({ passScore: 70, status: "locked" });

    await expect(
      submitAssignment(prisma, storage, student.id, userStep.id, { buffer: PDF_BYTES, originalName: "f.pdf" })
    ).rejects.toMatchObject({ code: "STEP_LOCKED" });
  });

  test("a different student gets FORBIDDEN", async () => {
    const { userStep } = await createFixture({ passScore: 70 });
    const otherStudent = await createUser("student");

    await expect(
      submitAssignment(prisma, storage, otherStudent.id, userStep.id, { buffer: PDF_BYTES, originalName: "f.pdf" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
