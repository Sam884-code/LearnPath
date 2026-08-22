"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { teacherListStuck, type ApiStuckStudent } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ErrorBanner } from "@/components/ui";

export default function StuckPage() {
  const t = useTranslations();
  const [students, setStudents] = useState<ApiStuckStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    teacherListStuck()
      .then((res) => setStudents(res.students))
      .catch((err) => setError(errorMessage(t, err)));
  }, [t]);

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
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
              >
                {t("teacher.attemptsUsed", { used: s.step.attempts, max: s.step.max_attempts ?? "∞" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </TeacherShell>
  );
}
