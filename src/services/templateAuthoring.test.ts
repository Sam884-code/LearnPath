import { describe, test, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { addQuestion, addTemplateStep, getTemplateDetail, publishTemplate, reorderSteps } from "./templateAuthoring";
import { TEST_DB_URL } from "../../tests/test-db-config";

const prisma = new PrismaClient({ datasourceUrl: TEST_DB_URL });

afterAll(async () => {
  await prisma.$disconnect();
});

async function createTeacher() {
  const suffix = randomUUID();
  return prisma.user.create({
    data: { name: "Teacher", email: `teacher-${suffix}@test.local`, passwordHash: "x", role: "teacher" },
  });
}

async function createDraftTemplate() {
  const teacher = await createTeacher();
  const suffix = randomUUID();
  const subject = await prisma.subject.create({ data: { title: "Subj", slug: `subj-${suffix}` } });
  const template = await prisma.roadmapTemplate.create({
    data: {
      subjectId: subject.id,
      track: "exam",
      title: "Draft",
      description: "d",
      authorId: teacher.id,
      isPublished: false,
    },
  });
  return { teacher, subject, template };
}

describe("publishTemplate", () => {
  test("refuses to publish a template with zero steps", async () => {
    const { template } = await createDraftTemplate();

    await expect(publishTemplate(prisma, template.id)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  test("refuses to publish when a quiz step has no questions", async () => {
    const { template } = await createDraftTemplate();
    await prisma.templateStep.create({
      data: {
        templateId: template.id,
        orderIndex: 1,
        title: "A quiz with nothing in it",
        description: "d",
        type: "quiz",
        estimatedMinutes: 10,
      },
    });

    await expect(publishTemplate(prisma, template.id)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  test("publishes successfully once every quiz step has at least one question", async () => {
    const { template } = await createDraftTemplate();
    await prisma.templateStep.create({
      data: {
        templateId: template.id,
        orderIndex: 1,
        title: "Lesson",
        description: "d",
        type: "lesson",
        estimatedMinutes: 10,
      },
    });
    const quizStep = await prisma.templateStep.create({
      data: {
        templateId: template.id,
        orderIndex: 2,
        title: "Quiz",
        description: "d",
        type: "quiz",
        estimatedMinutes: 10,
      },
    });
    await addQuestion(prisma, quizStep.id, {
      text: "2+2?",
      options: ["3", "4"],
      correctIndex: 1,
      explanation: "4",
    });

    const published = await publishTemplate(prisma, template.id);
    expect(published.isPublished).toBe(true);
  });

  test("refuses to publish when another template is already published for the same subject+track", async () => {
    const { teacher, subject, template } = await createDraftTemplate();
    await prisma.templateStep.create({
      data: {
        templateId: template.id,
        orderIndex: 1,
        title: "Lesson",
        description: "d",
        type: "lesson",
        estimatedMinutes: 10,
      },
    });

    // A second, already-published template for the exact same subject+track.
    const otherTemplate = await prisma.roadmapTemplate.create({
      data: {
        subjectId: subject.id,
        track: "exam",
        title: "Already published",
        description: "d",
        authorId: teacher.id,
        isPublished: true,
      },
    });
    await prisma.templateStep.create({
      data: {
        templateId: otherTemplate.id,
        orderIndex: 1,
        title: "Lesson",
        description: "d",
        type: "lesson",
        estimatedMinutes: 10,
      },
    });

    await expect(publishTemplate(prisma, template.id)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

describe("addTemplateStep", () => {
  test("refuses a duplicate order_index within the same template", async () => {
    const { template } = await createDraftTemplate();
    await addTemplateStep(prisma, template.id, {
      orderIndex: 1,
      title: "First",
      description: "d",
      type: "lesson",
      estimatedMinutes: 10,
    });

    await expect(
      addTemplateStep(prisma, template.id, {
        orderIndex: 1,
        title: "Duplicate order_index",
        description: "d",
        type: "lesson",
        estimatedMinutes: 10,
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("addQuestion", () => {
  test("refuses to add a question to a non-quiz step", async () => {
    const { template } = await createDraftTemplate();
    const lessonStep = await prisma.templateStep.create({
      data: {
        templateId: template.id,
        orderIndex: 1,
        title: "Lesson",
        description: "d",
        type: "lesson",
        estimatedMinutes: 10,
      },
    });

    await expect(
      addQuestion(prisma, lessonStep.id, { text: "?", options: ["a", "b"], correctIndex: 0, explanation: "e" })
    ).rejects.toMatchObject({ code: "WRONG_STEP_TYPE" });
  });

  test("auto-assigns increasing order_index across multiple questions", async () => {
    const { template } = await createDraftTemplate();
    const quizStep = await prisma.templateStep.create({
      data: {
        templateId: template.id,
        orderIndex: 1,
        title: "Quiz",
        description: "d",
        type: "quiz",
        estimatedMinutes: 10,
      },
    });

    const q1 = await addQuestion(prisma, quizStep.id, {
      text: "Q1",
      options: ["a", "b"],
      correctIndex: 0,
      explanation: "e",
    });
    const q2 = await addQuestion(prisma, quizStep.id, {
      text: "Q2",
      options: ["a", "b"],
      correctIndex: 1,
      explanation: "e",
    });

    expect(q1.orderIndex).toBe(1);
    expect(q2.orderIndex).toBe(2);
  });
});

describe("reorderSteps", () => {
  async function makeThreeSteps() {
    const { template } = await createDraftTemplate();
    const titles = ["First", "Second", "Third"];
    const steps = [];
    for (let i = 0; i < titles.length; i++) {
      steps.push(
        await addTemplateStep(prisma, template.id, {
          orderIndex: i + 1,
          title: titles[i],
          description: "d",
          type: "lesson",
          estimatedMinutes: 10,
        })
      );
    }
    return { template, steps };
  }

  test("reassigns order_index to match the given order (no unique-index collision)", async () => {
    const { template, steps } = await makeThreeSteps();
    // Reverse the order: Third, Second, First.
    const reordered = await reorderSteps(prisma, template.id, [steps[2].id, steps[1].id, steps[0].id]);

    expect(reordered.steps.map((s) => s.title)).toEqual(["Third", "Second", "First"]);
    expect(reordered.steps.map((s) => s.orderIndex)).toEqual([1, 2, 3]);
  });

  test("rejects an order list that doesn't cover every step exactly once", async () => {
    const { template, steps } = await makeThreeSteps();

    await expect(reorderSteps(prisma, template.id, [steps[0].id, steps[1].id])).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

describe("getTemplateDetail", () => {
  test("returns steps in order with their questions and materials", async () => {
    const { template } = await createDraftTemplate();
    const quiz = await addTemplateStep(prisma, template.id, {
      orderIndex: 1,
      title: "Quiz",
      description: "d",
      type: "quiz",
      estimatedMinutes: 10,
    });
    await addQuestion(prisma, quiz.id, { text: "Q1", options: ["a", "b"], correctIndex: 1, explanation: "e" });

    const detail = await getTemplateDetail(prisma, template.id);
    expect(detail.steps).toHaveLength(1);
    expect(detail.steps[0].questions).toHaveLength(1);
    // Teacher detail intentionally includes correct_index (they author it).
    expect(detail.steps[0].questions[0].correctIndex).toBe(1);
  });
});
