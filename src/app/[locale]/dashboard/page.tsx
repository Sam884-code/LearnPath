"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const TYPE_ICON: Record<ApiRoadmapStep["type"], string> = {
  lesson: "📖",
  quiz: "📝",
  assignment: "📤",
};

const spring = { type: "spring", stiffness: 380, damping: 30 } as const;

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
          <h1 className="text-xl font-bold text-foreground">{t("dashboard.noEnrollmentTitle")}</h1>
          <p className="mb-4 text-sm text-muted-foreground">{t("dashboard.noEnrollmentSubtitle")}</p>
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
    <Screen size="wide">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-5 pt-2"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("dashboard.title")}
        </p>
        <h1 className="text-2xl font-bold text-foreground">{roadmap.enrollment.subject.title}</h1>
      </motion.header>

      {/* On desktop: "what's next" on the left, the full path on the right.
          On mobile everything stacks in reading order. */}
      <div className="md:grid md:grid-cols-2 md:items-start md:gap-8">
        <div className="md:sticky md:top-8">
          <ProgressCard percent={progress.percent} done={progress.done} total={progress.total} t={t} />
          {finished ? (
            <FinishedCard t={t} />
          ) : activeStep ? (
            <ActiveStepCard step={activeStep} t={t} />
          ) : null}
        </div>

        <div className="mt-8 md:mt-0">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t("dashboard.wholePath")}</h2>
          <motion.ol
            className="flex flex-col gap-2"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
          >
            {roadmap.steps.map((s) => (
              <motion.li key={s.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                <RoadmapItem step={s} t={t} />
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </div>
    </Screen>
  );
}

type T = ReturnType<typeof useTranslations>;

function ProgressCard({ percent, done, total, t }: { percent: number; done: number; total: number; t: T }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
      <Card className="rounded-2xl p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{t("dashboard.progressLabel")}</span>
          <span className="text-muted-foreground">
            {t("dashboard.progressCount", { done, total })} · {percent}%
          </span>
        </div>
        {/* percent comes straight from the API — never recomputed here. */}
        <Progress value={percent} className="h-2.5" />
      </Card>
    </motion.div>
  );
}

// The one thing that should be obvious within a second: what to do next.
// Emerald glow + hover elevation + a soft pulsing ring behind the type icon.
function ActiveStepCard({ step, t }: { step: ApiRoadmapStep; t: T }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -4 }}
      transition={spring}
      className="mt-4"
    >
      <Link href={`/steps/${step.id}`} className="block">
        <Card
          className="active-glow gap-0 overflow-hidden rounded-3xl border-2 p-6"
          style={{ borderColor: "var(--success)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--success-text)" }}>
              {t("dashboard.activeStepLabel")}
            </span>
            {step.overdue && <Badge variant="warning">{t("dashboard.overdue")}</Badge>}
          </div>

          <div className="mt-3 flex items-start gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--success-soft)" }}
                animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="relative text-3xl leading-none">{TYPE_ICON[step.type]}</span>
            </span>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">{t(`stepType.${step.type}`)}</p>
              <h2 className="text-lg font-bold leading-snug text-foreground">{step.title}</h2>
            </div>
          </div>

          <div className="mt-5 w-full rounded-xl bg-primary px-5 py-3.5 text-center text-base font-semibold text-primary-foreground">
            {t("dashboard.openStep")}
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

function FinishedCard({ t }: { t: T }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring}
      className="mt-4 rounded-3xl p-7 text-center"
      style={{ background: "var(--success-soft)" }}
    >
      <motion.p
        className="text-3xl"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        🎉
      </motion.p>
      <h2 className="mt-2 text-lg font-bold" style={{ color: "var(--success-text)" }}>
        {t("dashboard.finishedTitle")}
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--success-text)" }}>
        {t("dashboard.finishedSubtitle")}
      </p>
    </motion.div>
  );
}

function RoadmapItem({ step, t }: { step: ApiRoadmapStep; t: T }) {
  const isLocked = step.status === "locked";
  const isActive = step.status === "active";
  const isDone = step.status === "done";

  const inner = (
    <Card
      className="flex flex-row items-center gap-3 rounded-2xl border px-4 py-3.5"
      style={{
        borderColor: isActive ? "var(--success)" : "var(--border)",
        background: isLocked ? "var(--surface-muted)" : "var(--surface)",
        opacity: isLocked ? 0.55 : 1,
        boxShadow: isActive ? "0 8px 24px -12px color-mix(in oklab, var(--success) 50%, transparent)" : undefined,
      }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        style={{
          background: isDone ? "var(--success)" : "var(--surface-muted)",
          color: isDone ? "#fff" : "var(--text-muted)",
        }}
      >
        {isDone ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : step.order_index}
      </span>

      <span className="text-xl leading-none" aria-hidden>
        {TYPE_ICON[step.type]}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{step.title}</span>
        {isDone && step.type === "quiz" && step.score !== null && (
          <span className="text-xs text-muted-foreground">{t("dashboard.scoreLabel", { score: step.score })}</span>
        )}
      </span>

      <StatusPill step={step} t={t} />
    </Card>
  );

  // Locked steps are not tappable and must not navigate.
  if (isLocked) {
    return <div aria-disabled>{inner}</div>;
  }
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} transition={spring}>
      <Link href={`/steps/${step.id}`} className="block">
        {inner}
      </Link>
    </motion.div>
  );
}

function StatusPill({ step, t }: { step: ApiRoadmapStep; t: T }) {
  if (step.status === "locked") {
    return (
      <Lock
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-label={t("dashboard.statusLocked")}
      />
    );
  }
  if (step.status === "active") {
    return step.overdue ? (
      <Badge variant="warning" className="shrink-0">
        {t("dashboard.overdue")}
      </Badge>
    ) : (
      <Badge variant="success" className="shrink-0">
        {t("dashboard.statusActive")}
      </Badge>
    );
  }
  // Completed: a muted (soft) green badge.
  return (
    <Badge variant="success" className="shrink-0 gap-1">
      <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
      {t("dashboard.statusDone")}
    </Badge>
  );
}

function DashboardSkeleton() {
  return (
    <Screen size="wide">
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
