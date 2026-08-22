import type { UserStepStatus } from "@prisma/client";

// SPEC.md §5.4: overdue = due_date < today AND status != 'done'. Shared by
// both the roadmap list and the step-detail endpoint so the definition can't
// drift between them.
export function isOverdue(dueDate: Date | null, status: UserStepStatus): boolean {
  if (!dueDate || status === "done") return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return dueDate < today;
}
