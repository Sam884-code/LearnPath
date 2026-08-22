import { Prisma, PrismaClient, UserStep } from "@prisma/client";
import { ApiError } from "@/lib/errors";

// Raw row shape from the FOR UPDATE query below — physical (snake_case)
// column names, not the Prisma model's camelCase field names.
export type LockedUserStepRow = {
  id: string;
  enrollment_id: string;
  order_index: number;
  status: "locked" | "active" | "done";
  attempts: number;
};

export type AdvanceStepResult = {
  completed: UserStep;
  next: UserStep | null;
  enrollment_finished: boolean;
};

// SPEC.md §4: the single source of truth for completing a step and unlocking
// the next one. Every completion path (lesson view, quiz pass, assignment
// grade) must call this instead of reimplementing the transition — that's
// what keeps "exactly one active step per enrollment" true under concurrency.
//
// Split into two functions: `advanceStepTx` assumes the caller already holds
// a `SELECT ... FOR UPDATE` lock on the row (taken as part of some larger
// transaction, e.g. quiz submission needs its own lock anyway to safely check
// attempts), while `advanceStep` is the public entry point that takes that
// lock itself. A caller that already has a `tx` + locked row must use
// `advanceStepTx` directly — calling `advanceStep` from inside an existing
// transaction would try to lock the same row a second time, on a second
// connection, and deadlock against its own outer transaction.
export async function advanceStepTx(tx: Prisma.TransactionClient, row: LockedUserStepRow): Promise<AdvanceStepResult> {
  if (row.status !== "active") {
    throw new ApiError(409, "STEP_NOT_ACTIVE", "This step is not currently active");
  }

  const completed = await tx.userStep.update({
    where: { id: row.id },
    data: { status: "done", completedAt: new Date() },
  });

  const next = await tx.userStep.findFirst({
    where: { enrollmentId: row.enrollment_id, orderIndex: row.order_index + 1 },
  });

  if (!next) {
    await tx.enrollment.update({
      where: { id: row.enrollment_id },
      data: { completedAt: new Date() },
    });
    return { completed, next: null, enrollment_finished: true };
  }

  const activated = await tx.userStep.update({
    where: { id: next.id },
    data: { status: "active", activatedAt: new Date() },
  });
  return { completed, next: activated, enrollment_finished: false };
}

export async function advanceStep(prisma: PrismaClient, userStepId: string): Promise<AdvanceStepResult> {
  return prisma.$transaction(async (tx) => {
    // Prisma's query builder has no `FOR UPDATE` — this raw query locks the
    // row for the duration of the transaction so a second concurrent call
    // blocks here until the first one commits, then sees the updated status.
    const rows = await tx.$queryRaw<LockedUserStepRow[]>`
      SELECT * FROM "user_steps" WHERE "id" = ${userStepId}::uuid FOR UPDATE
    `;
    const row = rows[0];
    if (!row) {
      throw new ApiError(409, "STEP_NOT_ACTIVE", "This step is not currently active");
    }
    return advanceStepTx(tx, row);
  });
}
