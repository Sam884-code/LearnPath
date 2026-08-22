"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import { ClientApiError, viewLesson, type ApiStepDetail } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { ErrorBanner, PrimaryButton } from "@/components/ui";
import { MaterialsList, StepHeader } from "./shared";

export function LessonView({
  step,
  onComplete,
}: {
  step: ApiStepDetail;
  onComplete: (r: { nextStepUnlocked: boolean; enrollmentFinished: boolean }) => void;
}) {
  const t = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function complete() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await viewLesson(step.id);
      onComplete({ nextStepUnlocked: res.next_step !== null, enrollmentFinished: res.enrollment_finished });
    } catch (err) {
      setError(errorMessage(t, err));
      setSubmitting(false);
      if (err instanceof ClientApiError && err.code === "STEP_NOT_ACTIVE") {
        // Already completed elsewhere — nothing more to do here.
      }
    }
  }

  return (
    <>
      <StepHeader t={t} orderIndex={step.order_index} type="lesson" title={step.title} overdue={step.overdue} />

      <article
        className="markdown-body rounded-2xl border p-5 leading-relaxed"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
      >
        <ReactMarkdown>{step.description}</ReactMarkdown>
      </article>

      <MaterialsList t={t} materials={step.materials} />

      {error && (
        <div className="mt-6">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="mt-6">
        <PrimaryButton onClick={complete} loading={submitting}>
          {submitting ? t("lesson.completing") : t("lesson.markComplete")}
        </PrimaryButton>
      </div>
    </>
  );
}
