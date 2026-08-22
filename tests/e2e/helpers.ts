import { Page, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { E2E_DB_URL } from "./e2e-config";

// Direct DB access for arranging preconditions (the "arrange" of each test).
// The "act" and "assert" always go through the real UI.
export const prisma = new PrismaClient({ datasourceUrl: E2E_DB_URL });

export function uniqueEmail() {
  return `e2e-${randomUUID()}@test.local`;
}

export type EnrolledStep = {
  id: string;
  orderIndex: number;
  type: "lesson" | "quiz" | "assignment";
  templateStepId: string;
};

// Registers a fresh student (sets the auth cookie on the page's context) and
// enrolls them into the seeded Մաթեմատիկա exam roadmap via the real API.
export async function registerAndEnroll(
  page: Page,
  opts: { wantsMentorQa?: boolean } = {}
): Promise<{ email: string; userId: string; enrollmentId: string; steps: EnrolledStep[] }> {
  const email = uniqueEmail();

  const reg = await page.request.post("/api/v1/auth/register", {
    data: { name: "Թեստ Աշակերտ", email, password: "password123" },
  });
  expect(reg.ok(), `register failed: ${reg.status()}`).toBeTruthy();

  const subject = await prisma.subject.findFirstOrThrow({ where: { slug: "mathematics" } });
  const enr = await page.request.post("/api/v1/enrollments", {
    data: {
      subject_id: subject.id,
      track: "exam",
      daily_hours: "1to2",
      wants_mentor_qa: opts.wantsMentorQa ?? false,
    },
  });
  expect(enr.ok(), `enroll failed: ${enr.status()}`).toBeTruthy();

  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    include: {
      enrollments: {
        include: { userSteps: { orderBy: { orderIndex: "asc" }, include: { templateStep: true } } },
      },
    },
  });
  const enrollment = user.enrollments[0];
  const steps = enrollment.userSteps.map((s) => ({
    id: s.id,
    orderIndex: s.orderIndex,
    type: s.templateStep.type,
    templateStepId: s.templateStepId,
  }));

  return { email, userId: user.id, enrollmentId: enrollment.id, steps };
}

// Makes the step at `orderIndex` the single active step (earlier steps done,
// later locked). Two-phase to respect the partial unique index that allows at
// most one active step per enrollment.
export async function makeStepActive(steps: EnrolledStep[], orderIndex: number) {
  for (const s of steps) {
    await prisma.userStep.update({
      where: { id: s.id },
      data: { status: "locked", activatedAt: null, completedAt: null },
    });
  }
  for (const s of steps) {
    if (s.orderIndex < orderIndex) {
      await prisma.userStep.update({ where: { id: s.id }, data: { status: "done", completedAt: new Date() } });
    }
  }
  const active = steps.find((s) => s.orderIndex === orderIndex)!;
  await prisma.userStep.update({ where: { id: active.id }, data: { status: "active", activatedAt: new Date() } });
  return active;
}

// Returns the quiz questions (with correct indices) so a test can deterministically
// choose wrong answers. Reads the template step, never exposed to the student UI.
export async function getQuizQuestions(templateStepId: string) {
  return prisma.question.findMany({
    where: { templateStepId },
    orderBy: { orderIndex: "asc" },
  });
}
