import { PrismaClient } from "@prisma/client";

// SPEC.md §5.8: GET /teacher/students/stuck — enrollments whose active step
// has attempts >= max_attempts. Comparing attempts (on user_steps) against
// max_attempts (on the related template_steps) is a cross-table comparison
// Prisma's query builder can't express directly, so this filters to active
// steps with a finite max_attempts, then compares in-memory — fine at MVP
// scale, and simpler than a raw SQL query for a read-only convenience report.
export async function listStuckStudents(prisma: PrismaClient) {
  const candidates = await prisma.userStep.findMany({
    where: { status: "active", templateStep: { maxAttempts: { not: null } } },
    include: {
      templateStep: true,
      enrollment: { include: { user: true, subject: true } },
    },
  });

  return candidates
    .filter((s) => s.attempts >= (s.templateStep.maxAttempts as number))
    .map((s) => ({
      enrollment_id: s.enrollmentId,
      student: { id: s.enrollment.user.id, name: s.enrollment.user.name, email: s.enrollment.user.email },
      subject: { id: s.enrollment.subject.id, title: s.enrollment.subject.title },
      step: {
        id: s.id,
        title: s.templateStep.title,
        attempts: s.attempts,
        max_attempts: s.templateStep.maxAttempts,
      },
    }));
}
