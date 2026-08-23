"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { teacherListStuck, teacherResetAttempts, type ApiStuckStudent } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ErrorBanner } from "@/components/ui";

export default function StuckPage() {
  const t = useTranslations();
  const [students, setStudents] = useState<ApiStuckStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetDoneIds, setResetDoneIds] = useState<Set<string>>(new Set());

  function load() {
    teacherListStuck()
      .then((res) => setStudents(res.students))
      .catch((err) => setError(errorMessage(t, err)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reset(userStepId: string) {
    setError(null);
    setResettingId(userStepId);
    try {
      await teacherResetAttempts(userStepId);
      setResetDoneIds((prev) => new Set(prev).add(userStepId));
      // The student is no longer "stuck" — refresh the list after a beat.
      setTimeout(load, 800);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setResettingId(null);
    }
  }

  return (
    <TeacherShell>
      <h1 className="mb-6 text-xl font-bold" style={{ color: "var(--text)" }}>
        {t("teacher.stuckTitle")}
      </h1>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {students === null ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("teacher.loading")}
        </p>
      ) : students.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("teacher.stuckEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {students.map((s) => (
            <li
              key={s.enrollment_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div>
                <span className="block text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {s.student.name}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {s.subject.title} · {s.step.title}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
                >
                  {t("teacher.attemptsUsed", { used: s.step.attempts, max: s.step.max_attempts ?? "∞" })}
                </span>
                {resetDoneIds.has(s.step.id) ? (
                  <span className="text-xs font-medium" style={{ color: "var(--accent-text)" }}>
                    {t("teacher.resetDone")}
                  </span>
                ) : (
                  <button
                    onClick={() => reset(s.step.id)}
                    disabled={resettingId === s.step.id}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                    style={{ borderColor: "var(--border)", color: "var(--accent-text)" }}
                  >
                    {resettingId === s.step.id ? t("teacher.resetting") : t("teacher.resetAttempts")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </TeacherShell>
  );
}
