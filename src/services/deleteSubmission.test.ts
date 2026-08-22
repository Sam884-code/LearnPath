import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { deleteSubmission } from "./deleteSubmission";
import { LocalStorageDriver } from "@/lib/storage/local";
import { TEST_DB_URL } from "../../tests/test-db-config";

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

async function createSubmissionFixture(grade: number | null) {
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
      type: "assignment",
      passScore: 70,
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
  const userStep = await prisma.userStep.create({
    data: {
      enrollmentId: enrollment.id,
      templateStepId: templateStep.id,
      orderIndex: 1,
      status: "active",
      activatedAt: new Date(),
    },
  });

  const key = `submissions/${userStep.id}/${randomUUID()}.pdf`;
  await storage.upload({ key, body: Buffer.from("fake pdf bytes"), contentType: "application/pdf" });
  const submission = await prisma.submission.create({
    data: {
      userStepId: userStep.id,
      fileKey: key,
      fileName: "homework.pdf",
      mimeType: "application/pdf",
      sizeBytes: BigInt(14),
      submittedAt: new Date(),
      grade,
    },
  });

  return { student, submission, fileKey: key };
}

describe("deleteSubmission", () => {
  test("deletes an ungraded submission the student owns", async () => {
    const { student, submission } = await createSubmissionFixture(null);

    await deleteSubmission(prisma, storage, student.id, submission.id);

    const found = await prisma.submission.findUnique({ where: { id: submission.id } });
    expect(found).toBeNull();
  });

  test("refuses to delete a graded submission", async () => {
    const { student, submission } = await createSubmissionFixture(85);

    await expect(deleteSubmission(prisma, storage, student.id, submission.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const found = await prisma.submission.findUnique({ where: { id: submission.id } });
    expect(found).not.toBeNull(); // untouched
  });

  test("a different student cannot delete someone else's submission", async () => {
    const { submission } = await createSubmissionFixture(null);
    const otherStudent = await createUser("student");

    await expect(deleteSubmission(prisma, storage, otherStudent.id, submission.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("a nonexistent submission returns NOT_FOUND", async () => {
    const student = await createUser("student");

    await expect(deleteSubmission(prisma, storage, student.id, randomUUID())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
