import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient, StepType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { gradeSubmission, listPendingSubmissions } from "./gradingQueue";
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

async function createSubmissionFixture(opts: { passScore: number; secondStep?: boolean }) {
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
  const assignmentStep = await prisma.templateStep.create({
    data: {
      templateId: template.id,
      orderIndex: 1,
      title: "Assignment",
      description: "d",
      type: "assignment" as StepType,
      passScore: opts.passScore,
      estimatedMinutes: 30,
    },
  });
  if (opts.secondStep) {
    await prisma.templateStep.create({
      data: {
        templateId: template.id,
        orderIndex: 2,
        title: "Lesson",
        description: "d",
        type: "lesson",
        estimatedMinutes: 10,
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
      templateStepId: assignmentStep.id,
      orderIndex: 1,
      status: "active",
      activatedAt: new Date(),
    },
  });

  let nextUserStep = null;
  if (opts.secondStep) {
    const lessonStep = await prisma.templateStep.findFirstOrThrow({
      where: { templateId: template.id, orderIndex: 2 },
    });
    nextUserStep = await prisma.userStep.create({
      data: { enrollmentId: enrollment.id, templateStepId: lessonStep.id, orderIndex: 2, status: "locked" },
    });
  }

  const submission = await prisma.submission.create({
    data: {
      userStepId: userStep.id,
      fileKey: "k",
      fileName: "f.pdf",
      mimeType: "application/pdf",
      sizeBytes: BigInt(10),
      submittedAt: new Date(),
    },
  });

  const grader = await createUser("teacher");
  return { grader, enrollment, userStep, nextUserStep, submission };
}

describe("gradeSubmission", () => {
  test("grade >= pass_score advances the step via advanceStep", async () => {
    const { grader, userStep, nextUserStep, submission } = await createSubmissionFixture({
      passScore: 70,
      secondStep: true,
    });

    const result = await gradeSubmission(prisma, grader.id, submission.id, 85, "Great work");

    expect(result.advanced).toBe(true);

    const storedSubmission = await prisma.submission.findUniqueOrThrow({ where: { id: submission.id } });
    expect(storedSubmission.grade).toBe(85);
    expect(storedSubmission.feedback).toBe("Great work");
    expect(storedSubmission.gradedById).toBe(grader.id);
    expect(storedSubmission.gradedAt).not.toBeNull();

    const storedUserStep = await prisma.userStep.findUniqueOrThrow({ where: { id: userStep.id } });
    expect(storedUserStep.status).toBe("done");

    const storedNextStep = await prisma.userStep.findUniqueOrThrow({ where: { id: nextUserStep!.id } });
    expect(storedNextStep.status).toBe("active");
    expect(storedNextStep.activatedAt).not.toBeNull();
  });

  test("grade < pass_score does not advance; step stays active with feedback", async () => {
    const { grader, userStep, submission } = await createSubmissionFixture({ passScore: 70 });

    const result = await gradeSubmission(prisma, grader.id, submission.id, 40, "Needs revision");

    expect(result.advanced).toBe(false);

    const storedUserStep = await prisma.userStep.findUniqueOrThrow({ where: { id: userStep.id } });
    expect(storedUserStep.status).toBe("active");

    const storedSubmission = await prisma.submission.findUniqueOrThrow({ where: { id: submission.id } });
    expect(storedSubmission.grade).toBe(40);
    expect(storedSubmission.feedback).toBe("Needs revision");
  });

  test("passing the last step finishes the enrollment", async () => {
    const { grader, enrollment, submission } = await createSubmissionFixture({ passScore: 70 });

    const result = await gradeSubmission(prisma, grader.id, submission.id, 90, null);

    expect(result.advanced).toBe(true);
    expect(result.enrollment_finished).toBe(true);

    const storedEnrollment = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
    expect(storedEnrollment.completedAt).not.toBeNull();
  });

  test("grading a historical (already-resolved) submission doesn't throw or re-advance", async () => {
    const { grader, userStep, submission } = await createSubmissionFixture({ passScore: 70 });

    // First grade fails the step, leaving it active for a re-upload.
    await gradeSubmission(prisma, grader.id, submission.id, 40, "try again");

    // A second, newer submission is uploaded and passes, advancing the step.
    const secondSubmission = await prisma.submission.create({
      data: {
        userStepId: userStep.id,
        fileKey: "k2",
        fileName: "f2.pdf",
        mimeType: "application/pdf",
        sizeBytes: BigInt(10),
        submittedAt: new Date(),
      },
    });
    await gradeSubmission(prisma, grader.id, secondSubmission.id, 90, "good");

    const storedUserStep = await prisma.userStep.findUniqueOrThrow({ where: { id: userStep.id } });
    expect(storedUserStep.status).toBe("done");

    // Re-grading the original (now-historical) failed submission must not
    // try to advance an already-done step.
    const result = await gradeSubmission(prisma, grader.id, submission.id, 95, "actually great");
    expect(result.advanced).toBe(false);
  });
});

describe("listPendingSubmissions", () => {
  test("only includes ungraded submissions", async () => {
    const { submission } = await createSubmissionFixture({ passScore: 70 });
    const { grader, submission: graded } = await createSubmissionFixture({ passScore: 70 });
    await gradeSubmission(prisma, grader.id, graded.id, 90, null);

    const pending = await listPendingSubmissions(prisma);
    const ids = pending.map((s) => s.id);

    expect(ids).toContain(submission.id);
    expect(ids).not.toContain(graded.id);
  });
});
