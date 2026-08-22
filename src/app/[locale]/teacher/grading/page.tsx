"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  teacherGradeSubmission,
  teacherListSubmissions,
  type ApiPendingSubmission,
} from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ErrorBanner } from "@/components/ui";

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
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("teacher.loading")}
        </p>
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
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const g = Number(grade);
    if (!Number.isFinite(g) || g < 0 || g > 100) return;
    setSubmitting(true);
    try {
      const res = await teacherGradeSubmission(submission.id, g, feedback);
      setDone(res.advanced ? t("teacher.gradedAdvanced") : t("teacher.gradedStay"));
      setTimeout(onGraded, 900);
    } catch (err) {
      onError(errorMessage(t, err));
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="block text-sm font-semibold" style={{ color: "var(--text)" }}>
            {submission.student.name}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {submission.step.title}
          </span>
        </div>
        <a
          href={`/api/v1/submissions/${submission.id}/file`}
          target="_blank"
          rel="noreferrer"
          className="rounded border px-3 py-1.5 text-xs font-medium"
          style={{ borderColor: "var(--border)", color: "var(--accent-text)" }}
        >
          {submission.file_name} ↓
        </a>
      </div>

      {done ? (
        <p className="text-sm font-medium" style={{ color: "var(--accent-text)" }}>
          {done}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--text-muted)" }}>
              {t("teacher.grade")}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              required
              className="w-24 rounded border px-3 py-2"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
          <label className="flex-1 text-sm" style={{ minWidth: 200 }}>
            <span className="mb-1 block" style={{ color: "var(--text-muted)" }}>
              {t("teacher.feedback")}
            </span>
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full rounded border px-3 py-2"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            {submitting ? t("teacher.grading") : t("teacher.submitGrade")}
          </button>
        </form>
      )}
    </div>
  );
}
