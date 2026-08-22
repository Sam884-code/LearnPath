import type { Enrollment, Submission, Subject, TemplateStep, User, UserStep } from "@prisma/client";

export function serializeSubmission(submission: Submission) {
  return {
    id: submission.id,
    file_name: submission.fileName,
    submitted_at: submission.submittedAt,
    // grade/feedback are included so this matches the submission shape returned
    // by GET /steps/:id. A freshly uploaded submission has grade === null, which
    // the client relies on to show the "awaiting review" state.
    grade: submission.grade,
    feedback: submission.feedback,
  };
}

export function serializeSubject(subject: Subject) {
  return {
    id: subject.id,
    title: subject.title,
    slug: subject.slug,
    icon: subject.icon,
  };
}

export function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    locale: user.locale,
  };
}

// Used by /steps/:id/view and /steps/:id/quiz/submit for their `step` and
// `next_step` fields — a compact summary, distinct from the richer roadmap
// list item (which also carries overdue/awaiting_review).
export function serializeUserStepSummary(userStep: UserStep, templateStep: TemplateStep) {
  return {
    id: userStep.id,
    order_index: userStep.orderIndex,
    title: templateStep.title,
    type: templateStep.type,
    status: userStep.status,
    score: userStep.score,
    attempts: userStep.attempts,
    due_date: userStep.dueDate,
  };
}

export function serializeEnrollment(enrollment: Enrollment) {
  return {
    id: enrollment.id,
    subjectId: enrollment.subjectId,
    templateId: enrollment.templateId,
    track: enrollment.track,
    pace: enrollment.pace,
    wantsMentorQa: enrollment.wantsMentorQa,
    startedAt: enrollment.startedAt,
    completedAt: enrollment.completedAt,
  };
}
