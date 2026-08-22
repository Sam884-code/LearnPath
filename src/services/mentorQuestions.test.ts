import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  answerMentorQuestion,
  askMentorQuestion,
  listMentorQuestions,
  listQuestionsForTeacher,
} from "./mentorQuestions";
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

async function createEnrollmentFixture(wantsMentorQa: boolean) {
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
  const enrollment = await prisma.enrollment.create({
    data: {
      userId: student.id,
      subjectId: subject.id,
      templateId: template.id,
      track: "exam",
      pace: "normal",
      wantsMentorQa,
      rawAnswers: {},
      startedAt: new Date(),
    },
  });

  return { teacher, student, enrollment };
}

describe("askMentorQuestion / listMentorQuestions", () => {
  // Explicitly required: mentor Q&A endpoints must 403 FORBIDDEN when the
  // enrollment has wants_mentor_qa = false.
  test("returns FORBIDDEN when wants_mentor_qa is false", async () => {
    const { student, enrollment } = await createEnrollmentFixture(false);

    await expect(askMentorQuestion(prisma, student.id, enrollment.id, "Can I ask something?", null)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(listMentorQuestions(prisma, student.id, enrollment.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("succeeds when wants_mentor_qa is true", async () => {
    const { student, enrollment } = await createEnrollmentFixture(true);

    const question = await askMentorQuestion(prisma, student.id, enrollment.id, "What is a variable?", null);
    expect(question.body).toBe("What is a variable?");
    expect(question.answer).toBeNull();

    const list = await listMentorQuestions(prisma, student.id, enrollment.id);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(question.id);
  });

  test("a different student cannot ask or list questions on someone else's enrollment", async () => {
    const { enrollment } = await createEnrollmentFixture(true);
    const otherStudent = await createUser("student");

    await expect(askMentorQuestion(prisma, otherStudent.id, enrollment.id, "hi", null)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(listMentorQuestions(prisma, otherStudent.id, enrollment.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("a nonexistent enrollment returns NOT_FOUND", async () => {
    const student = await createUser("student");
    await expect(askMentorQuestion(prisma, student.id, randomUUID(), "hi", null)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("answerMentorQuestion", () => {
  test("a teacher can answer a question", async () => {
    const { teacher, student, enrollment } = await createEnrollmentFixture(true);
    const question = await askMentorQuestion(prisma, student.id, enrollment.id, "What is a variable?", null);

    const answered = await answerMentorQuestion(prisma, teacher.id, question.id, "It's a named value that can change.");

    expect(answered.answer).toBe("It's a named value that can change.");
    expect(answered.answered_at).not.toBeNull();
  });

  test("a nonexistent question returns NOT_FOUND", async () => {
    const teacher = await createUser("teacher");
    await expect(answerMentorQuestion(prisma, teacher.id, randomUUID(), "answer")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("listQuestionsForTeacher", () => {
  test("onlyUnanswered filters out answered questions and carries student/subject context", async () => {
    const { teacher, student, enrollment } = await createEnrollmentFixture(true);
    const open = await askMentorQuestion(prisma, student.id, enrollment.id, "Open question", null);
    const toAnswer = await askMentorQuestion(prisma, student.id, enrollment.id, "Answered question", null);
    await answerMentorQuestion(prisma, teacher.id, toAnswer.id, "Here you go");

    const unanswered = await listQuestionsForTeacher(prisma, true);
    const ids = unanswered.map((q) => q.id);
    expect(ids).toContain(open.id);
    expect(ids).not.toContain(toAnswer.id);

    const openRow = unanswered.find((q) => q.id === open.id)!;
    expect(openRow.student.name).toBe(student.name);
    expect(openRow.subject.title).toBeTruthy();

    const all = await listQuestionsForTeacher(prisma, false);
    expect(all.map((q) => q.id)).toEqual(expect.arrayContaining([open.id, toAnswer.id]));
  });
});
