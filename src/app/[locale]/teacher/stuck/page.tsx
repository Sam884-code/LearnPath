"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { teacherListStuck, teacherResetAttempts, type ApiStuckStudent } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ErrorBanner } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function StuckPage() {
  const t = useTranslations();
  const [students, setStudents] = useState<ApiStuckStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

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
      toast.success(t("teacher.resetDone"));
      // The student is no longer "stuck" — refresh the list.
      load();
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
            <li key={s.enrollment_id}>
              <Card className="flex flex-row flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3">
                <div>
                  <span className="block text-sm font-semibold text-foreground">{s.student.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.subject.title} · {s.step.title}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="warning">
                    {t("teacher.attemptsUsed", { used: s.step.attempts, max: s.step.max_attempts ?? "∞" })}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reset(s.step.id)}
                    disabled={resettingId === s.step.id}
                  >
                    {resettingId === s.step.id ? t("teacher.resetting") : t("teacher.resetAttempts")}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </TeacherShell>
  );
}
