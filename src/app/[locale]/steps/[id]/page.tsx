"use client";

import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ClientApiError, getStep, type ApiStepDetail } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { ErrorBanner, Screen, Skeleton } from "@/components/ui";
import { CompletionOverlay } from "@/components/step/shared";
import { LessonView } from "@/components/step/LessonView";
import { QuizView } from "@/components/step/QuizView";
import { AssignmentView } from "@/components/step/AssignmentView";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; code: ClientApiError["code"] | null; message: string }
  | { kind: "ready"; step: ApiStepDetail };

export default function StepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [completion, setCompletion] = useState<{ nextStepUnlocked: boolean; enrollmentFinished: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStep(id)
      .then((step) => {
        if (!cancelled) setState({ kind: "ready", step });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ClientApiError && err.code === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }
        const code = err instanceof ClientApiError ? err.code : null;
        setState({ kind: "error", code, message: errorMessage(t, err) });
      });
    return () => {
      cancelled = true;
    };
  }, [id, router, t]);

  if (completion) {
    return (
      <CompletionOverlay
        t={t}
        nextStepUnlocked={completion.nextStepUnlocked}
        enrollmentFinished={completion.enrollmentFinished}
      />
    );
  }

  if (state.kind === "loading") {
    return (
      <Screen size="reading">
        <Skeleton className="h-4 w-24" radius={6} />
        <div className="mt-6">
          <Skeleton className="h-8 w-56" />
        </div>
        <div className="mt-6">
          <Skeleton className="h-40 w-full" radius={16} />
        </div>
      </Screen>
    );
  }

  if (state.kind === "error") {
    // A locked step is a distinct, friendlier state than a generic error.
    if (state.code === "STEP_LOCKED") {
      return (
        <Screen size="reading">
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-4xl">🔒</p>
            <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>
              {t("step.lockedTitle")}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {t("step.lockedBody")}
            </p>
            <Link href="/dashboard" className="mt-2 text-sm font-semibold" style={{ color: "var(--accent-text)" }}>
              {t("step.backToDashboard")}
            </Link>
          </div>
        </Screen>
      );
    }
    return (
      <Screen size="reading">
        <div className="flex flex-1 flex-col justify-center gap-4">
          <ErrorBanner message={state.message} />
          <Link href="/dashboard" className="text-center text-sm font-semibold" style={{ color: "var(--accent-text)" }}>
            {t("step.backToDashboard")}
          </Link>
        </div>
      </Screen>
    );
  }

  const { step } = state;

  return (
    <Screen size="reading">
      {step.type === "lesson" && <LessonView step={step} onComplete={setCompletion} />}
      {step.type === "quiz" && <QuizView step={step} />}
      {step.type === "assignment" && <AssignmentView step={step} onComplete={setCompletion} />}
    </Screen>
  );
}
