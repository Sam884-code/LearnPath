import { test, expect, Page } from "@playwright/test";
import {
  EnrolledStep,
  getQuizQuestions,
  makeStepActive,
  prisma,
  registerAndEnroll,
} from "./helpers";

// Each test covers one row of SPEC.md §4's edge-case table, arranged via the DB
// and verified through the real student UI.

test.afterAll(async () => {
  await prisma.$disconnect();
});

function quizStep(steps: EnrolledStep[]) {
  return steps.find((s) => s.type === "quiz")!;
}
function assignmentStep(steps: EnrolledStep[]) {
  return steps.find((s) => s.type === "assignment")!;
}

// Drives the one-question-per-screen quiz UI, choosing each answer via `pick`.
async function answerQuiz(
  page: Page,
  questions: { options: unknown; correctIndex: number }[],
  pick: (q: { options: string[]; correctIndex: number }) => number
) {
  for (let i = 0; i < questions.length; i++) {
    const opts = questions[i].options as string[];
    const choose = pick({ options: opts, correctIndex: questions[i].correctIndex });
    await page.getByRole("button", { name: opts[choose], exact: true }).click();
    if (i < questions.length - 1) {
      await page.getByRole("button", { name: "Հաջորդ" }).click();
    } else {
      await page.getByRole("button", { name: "Ստուգել պատասխանները" }).click();
    }
  }
  await page.getByRole("button", { name: "Հանձնել" }).click();
}

// Row 1: Quiz failed → step stays active, wrong answers + explanations shown, retry allowed.
test("quiz failed: stays active, shows explanations, offers retry", async ({ page }) => {
  const { steps } = await registerAndEnroll(page);
  const quiz = quizStep(steps);
  await makeStepActive(steps, quiz.orderIndex);
  const questions = await getQuizQuestions(quiz.templateStepId);

  await page.goto(`/hy/steps/${quiz.id}`);
  // Answer everything wrong.
  await answerQuiz(page, questions, (q) => (q.correctIndex === 0 ? 1 : 0));

  await expect(page.getByText("Չհանձնված")).toBeVisible();
  // An explanation from the seed is surfaced on the result screen.
  await expect(page.getByText(questions[0].explanation as string)).toBeVisible();
  // Retry is offered immediately (not hard-locked).
  await expect(page.getByRole("button", { name: "Կրկնել" })).toBeVisible();

  // The step is still active on the dashboard (it did not advance).
  const row = await prisma.userStep.findUniqueOrThrow({ where: { id: quiz.id } });
  expect(row.status).toBe("active");
  expect(row.attempts).toBe(1);
});

// Row 2: Attempts exhausted → NO_ATTEMPTS_LEFT, materials + mentor prompt, never hard-locked.
test("attempts exhausted: shows no-attempts state and mentor prompt, stays active", async ({ page }) => {
  const { steps } = await registerAndEnroll(page, { wantsMentorQa: true });
  const quiz = quizStep(steps);
  const active = await makeStepActive(steps, quiz.orderIndex);
  // Exhaust attempts (seed quiz has max_attempts = 3).
  await prisma.userStep.update({ where: { id: active.id }, data: { attempts: 3 } });

  await page.goto(`/hy/steps/${quiz.id}`);

  await expect(page.getByText("Փորձերն սպառված են")).toBeVisible();
  // Mentor prompt shown because wants_mentor_qa is true.
  await expect(page.getByRole("button", { name: "Ուղարկել հարցը" })).toBeVisible();

  // Never hard-locked: the step is still active in the DB.
  const row = await prisma.userStep.findUniqueOrThrow({ where: { id: quiz.id } });
  expect(row.status).toBe("active");
});

// Row 3: due_date passed → step stays active, soft overdue warning, no auto-lock.
test("overdue: shows soft warning, step stays active and tappable", async ({ page }) => {
  const { steps } = await registerAndEnroll(page);
  const active = steps.find((s) => s.orderIndex === 1)!;
  const past = new Date();
  past.setUTCDate(past.getUTCDate() - 3);
  await prisma.userStep.update({ where: { id: active.id }, data: { dueDate: past } });

  await page.goto("/hy/dashboard");

  // Soft warning appears (on the active-step card).
  await expect(page.getByText("Ժամկետը լրացել է").first()).toBeVisible();
  // Still tappable — the active step links to its detail (not blocked).
  await expect(page.locator(`a[href="/hy/steps/${active.id}"]`).first()).toBeVisible();

  const row = await prisma.userStep.findUniqueOrThrow({ where: { id: active.id } });
  expect(row.status).toBe("active");
});

// Row 4: Assignment ungraded → awaiting_review sub-state.
test("assignment ungraded: shows awaiting-review state", async ({ page }) => {
  const { steps } = await registerAndEnroll(page);
  const asg = assignmentStep(steps);
  const active = await makeStepActive(steps, asg.orderIndex);
  await prisma.submission.create({
    data: {
      userStepId: active.id,
      fileKey: "k",
      fileName: "solution.pdf",
      mimeType: "application/pdf",
      sizeBytes: BigInt(100),
      submittedAt: new Date(),
    },
  });

  await page.goto(`/hy/steps/${asg.id}`);

  await expect(page.getByText("Ուղարկված է, սպասում է ստուգման")).toBeVisible();

  const row = await prisma.userStep.findUniqueOrThrow({ where: { id: asg.id } });
  expect(row.status).toBe("active");
});

// Row 5: Assignment graded below pass → feedback shown, re-upload offered, stays active.
test("assignment graded below pass: shows feedback and re-upload", async ({ page }) => {
  const { steps } = await registerAndEnroll(page);
  const asg = assignmentStep(steps);
  const active = await makeStepActive(steps, asg.orderIndex);
  await prisma.submission.create({
    data: {
      userStepId: active.id,
      fileKey: "k",
      fileName: "solution.pdf",
      mimeType: "application/pdf",
      sizeBytes: BigInt(100),
      submittedAt: new Date(),
      grade: 40,
      feedback: "Խնդիր 3-ը սխալ է։",
      gradedAt: new Date(),
    },
  });

  await page.goto(`/hy/steps/${asg.id}`);

  await expect(page.getByText("Խնդիր 3-ը սխալ է։")).toBeVisible();
  await expect(page.getByText("40%")).toBeVisible();
  // May re-upload.
  await expect(page.getByRole("button", { name: "Վերբեռնել նորից" })).toBeVisible();

  const row = await prisma.userStep.findUniqueOrThrow({ where: { id: asg.id } });
  expect(row.status).toBe("active");
});

// Row 6: Student opens a locked step → 403 STEP_LOCKED (shown as the locked screen).
test("locked step: shows locked screen (STEP_LOCKED)", async ({ page }) => {
  const { steps } = await registerAndEnroll(page);
  // Fresh enrollment: step 1 is active, everything after is locked.
  const locked = steps.find((s) => s.orderIndex === 2)!;

  await page.goto(`/hy/steps/${locked.id}`);

  await expect(page.getByText("Այս քայլը դեռ փակ է")).toBeVisible();
});
