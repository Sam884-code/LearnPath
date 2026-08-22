"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  ClientApiError,
  getMe,
  getRoadmap,
  type ApiRoadmap,
  type ApiRoadmapStep,
} from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { ErrorBanner, PrimaryButton, Screen, Skeleton } from "@/components/ui";

const TYPE_ICON: Record<ApiRoadmapStep["type"], string> = {
  lesson: "📖",
  quiz: "📝",
  assignment: "📤",
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | { kind: "ready"; roadmap: ApiRoadmap };

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        const live = me.enrollments.find((e) => e.completedAt === null) ?? me.enrollments[0];
        if (!live) {
          if (!cancelled) setState({ kind: "empty" });
          return;
        }
        const roadmap = await getRoadmap(live.id);
        if (!cancelled) setState({ kind: "ready", roadmap });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ClientApiError && err.code === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }
        setState({ kind: "error", message: errorMessage(t, err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, t]);

  if (state.kind === "loading") return <DashboardSkeleton />;

  if (state.kind === "error") {
    return (
      <Screen>
        <div className="flex flex-1 flex-col justify-center">
          <ErrorBanner message={state.message} />
        </div>
      </Screen>
    );
  }

  if (state.kind === "empty") {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-5xl">🧭</p>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            {t("dashboard.noEnrollmentTitle")}
          </h1>
          <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
            {t("dashboard.noEnrollmentSubtitle")}
          </p>
          <div className="w-full">
            <PrimaryButton onClick={() => router.replace("/onboarding")}>
              {t("dashboard.noEnrollmentAction")}
            </PrimaryButton>
          </div>
        </div>
      </Screen>
    );
  }

  const { roadmap } = state;
  const { progress } = roadmap;
  const activeStep = roadmap.steps.find((s) => s.id === progress.active_step_id) ?? null;
  const finished = roadmap.enrollment.completed_at !== null;

  return (
    <Screen>
      <header className="mb-5 pt-2">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {t("dashboard.title")}
        </p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          {roadmap.enrollment.subject.title}
        </h1>
      </header>

      <ProgressBar percent={progress.percent} done={progress.done} total={progress.total} t={t} />

      {finished ? (
        <FinishedCard t={t} />
      ) : activeStep ? (
        <ActiveStepCard step={activeStep} t={t} />
      ) : null}

      <h2 className="mb-3 mt-8 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
        {t("dashboard.wholePath")}
      </h2>
      <ol className="flex flex-col gap-2">
        {roadmap.steps.map((s) => (
          <li key={s.id}>
            <RoadmapItem step={s} t={t} />
          </li>
        ))}
      </ol>
    </Screen>
  );
}

type T = ReturnType<typeof useTranslations>;

function ProgressBar({ percent, done, total, t }: { percent: number; done: number; total: number; t: T }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium" style={{ color: "var(--text)" }}>
          {t("dashboard.progressLabel")}
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          {t("dashboard.progressCount", { done, total })} · {percent}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-muted)" }}>
        {/* percent comes straight from the API — never recomputed here. */}
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: "var(--accent)" }} />
      </div>
    </div>
  );
}

// The one thing that should be obvious within a second: what to do next.
function ActiveStepCard({ step, t }: { step: ApiRoadmapStep; t: T }) {
  return (
    <Link
      href={`/steps/${step.id}`}
      className="mt-4 block rounded-3xl border-2 p-6 transition-shadow hover:shadow-lg"
      style={{ borderColor: "var(--accent)", background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--accent-text)" }}>
          {t("dashboard.activeStepLabel")}
        </span>
        {step.overdue && (
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
          >
            {t("dashboard.overdue")}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-start gap-3">
        <span className="text-3xl leading-none">{TYPE_ICON[step.type]}</span>
        <div className="flex-1">
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            {t(`stepType.${step.type}`)}
          </p>
          <h2 className="text-lg font-bold leading-snug" style={{ color: "var(--text)" }}>
            {step.title}
          </h2>
        </div>
      </div>

      <div
        className="mt-5 w-full rounded-2xl px-5 py-3.5 text-center text-base font-semibold text-white"
        style={{ background: "var(--accent)" }}
      >
        {t("dashboard.openStep")}
      </div>
    </Link>
  );
}

function FinishedCard({ t }: { t: T }) {
  return (
    <div className="mt-4 rounded-3xl p-7 text-center" style={{ background: "var(--accent-soft)" }}>
      <p className="text-3xl">🎉</p>
      <h2 className="mt-2 text-lg font-bold" style={{ color: "var(--accent-text)" }}>
        {t("dashboard.finishedTitle")}
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--accent-text)" }}>
        {t("dashboard.finishedSubtitle")}
      </p>
    </div>
  );
}

function RoadmapItem({ step, t }: { step: ApiRoadmapStep; t: T }) {
  const isLocked = step.status === "locked";
  const isActive = step.status === "active";
  const isDone = step.status === "done";

  const inner = (
    <div
      className="flex items-center gap-3 rounded-2xl border px-4 py-3.5"
      style={{
        borderColor: isActive ? "var(--accent)" : "var(--border)",
        background: isLocked ? "var(--surface-muted)" : "var(--surface)",
        opacity: isLocked ? 0.55 : 1,
      }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        style={{
          background: isDone ? "var(--accent)" : "var(--surface-muted)",
          color: isDone ? "#fff" : "var(--text-muted)",
        }}
      >
        {isDone ? "✓" : step.order_index}
      </span>

      <span className="text-xl leading-none" aria-hidden>
        {TYPE_ICON[step.type]}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium" style={{ color: "var(--text)" }}>
          {step.title}
        </span>
        {/* Score shown only for a completed quiz. */}
        {isDone && step.type === "quiz" && step.score !== null && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t("dashboard.scoreLabel", { score: step.score })}
          </span>
        )}
      </span>

      <StatusPill step={step} t={t} />
    </div>
  );

  // Locked steps are not tappable and must not navigate.
  if (isLocked) {
    return (
      <div aria-disabled className="cursor-default">
        {inner}
      </div>
    );
  }
  return <Link href={`/steps/${step.id}`}>{inner}</Link>;
}

function StatusPill({ step, t }: { step: ApiRoadmapStep; t: T }) {
  if (step.status === "locked") {
    return (
      <span className="shrink-0 text-base" aria-label={t("dashboard.statusLocked")}>
        🔒
      </span>
    );
  }
  if (step.status === "active") {
    const overdue = step.overdue;
    return (
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
        style={{
          background: overdue ? "var(--danger-soft)" : "var(--accent-soft)",
          color: overdue ? "var(--danger)" : "var(--accent-text)",
        }}
      >
        {overdue ? t("dashboard.overdue") : t("dashboard.statusActive")}
      </span>
    );
  }
  return (
    <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
      {t("dashboard.statusDone")}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <Screen>
      <div className="mb-5 pt-2">
        <Skeleton className="h-3 w-20" radius={6} />
        <div className="mt-2">
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" radius={16} />
      <div className="mt-4">
        <Skeleton className="h-44 w-full" radius={24} />
      </div>
      <div className="mt-8">
        <Skeleton className="mb-3 h-3 w-24" radius={6} />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" radius={16} />
          ))}
        </div>
      </div>
    </Screen>
  );
}
