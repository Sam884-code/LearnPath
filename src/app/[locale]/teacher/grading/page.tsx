"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  teacherGradeSubmission,
  teacherListSubmissions,
  type ApiPendingSubmission,
} from "@/lib/api-client";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errorMessages";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ListSkeleton } from "@/components/teacher/ListSkeleton";
import { ErrorBanner } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type T = ReturnType<typeof useTranslations>;

export default function GradingPage() {
  const t = useTranslations();
  const [subs, setSubs] = useState<ApiPendingSubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await teacherListSubmissions();
      setSubs(res.submissions);
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TeacherShell>
      <h1 className="mb-6 text-xl font-bold" style={{ color: "var(--text)" }}>
        {t("teacher.gradingTitle")}
      </h1>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {subs === null ? (
        <ListSkeleton />
      ) : subs.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("teacher.gradingEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {subs.map((s) => (
            <li key={s.id}>
              <GradeCard t={t} submission={s} onGraded={load} onError={setError} />
            </li>
          ))}
        </ul>
      )}
    </TeacherShell>
  );
}

function GradeCard({
  t,
  submission,
  onGraded,
  onError,
}: {
  t: T;
  submission: ApiPendingSubmission;
  onGraded: () => void;
  onError: (m: string) => void;
}) {
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const g = Number(grade);
    if (!Number.isFinite(g) || g < 0 || g > 100) return;
    setSubmitting(true);
    try {
      const res = await teacherGradeSubmission(submission.id, g, feedback);
      toast.success(res.advanced ? t("teacher.gradedAdvanced") : t("teacher.gradedStay"));
      onGraded();
    } catch (err) {
      onError(errorMessage(t, err));
      setSubmitting(false);
    }
  }

  return (
    <Card className="gap-0 rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="block text-sm font-semibold text-foreground">{submission.student.name}</span>
          <span className="text-xs text-muted-foreground">{submission.step.title}</span>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/v1/submissions/${submission.id}/file`} target="_blank" rel="noreferrer">
            {submission.file_name} ↓
          </a>
        </Button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <div className="text-sm">
          <Label className="mb-1 text-muted-foreground">{t("teacher.grade")}</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            required
            className="w-24"
          />
        </div>
        <div className="flex-1 text-sm" style={{ minWidth: 200 }}>
          <Label className="mb-1 text-muted-foreground">{t("teacher.feedback")}</Label>
          <Input value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? t("teacher.grading") : t("teacher.submitGrade")}
        </Button>
      </form>
    </Card>
  );
}
