"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { ApiMaterial, StepType } from "@/lib/api-client";

const TYPE_ICON: Record<StepType, string> = {
  lesson: "📖",
  quiz: "📝",
  assignment: "📤",
};

type T = ReturnType<typeof useTranslations>;

export function StepHeader({
  t,
  orderIndex,
  type,
  title,
  overdue,
}: {
  t: T;
  orderIndex: number;
  type: StepType;
  title: string;
  overdue?: boolean;
}) {
  return (
    <header className="mb-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        <span aria-hidden>←</span> {t("step.backToDashboard")}
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {TYPE_ICON[type]} {t("step.stepLabel", { n: orderIndex })} · {t(`stepType.${type}`)}
        </span>
        {overdue && (
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
          >
            {t("dashboard.overdue")}
          </span>
        )}
      </div>

      <h1 className="mt-1 text-2xl font-bold leading-snug" style={{ color: "var(--text)" }}>
        {title}
      </h1>
    </header>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MaterialsList({ t, materials }: { t: T; materials: ApiMaterial[] }) {
  if (materials.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
        {t("step.materials")}
      </h2>
      <ul className="flex flex-col gap-2">
        {materials.map((m) => (
          <li key={m.id}>
            <a
              href={m.download_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border px-4 py-3"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <span className="text-lg" aria-hidden>
                📎
              </span>
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--text)" }}>
                {m.file_name}
              </span>
              <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
                {formatSize(m.size_bytes)} ↓
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// A brief, celebratory confirmation shown when a step completes. It auto-returns
// to the dashboard so the newly-active step is visible, with a manual button too.
export function CompletionOverlay({
  t,
  nextStepUnlocked,
  enrollmentFinished,
}: {
  t: T;
  nextStepUnlocked: boolean;
  enrollmentFinished: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.push("/dashboard"), 1800);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--bg)" }}
      role="status"
    >
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
        style={{ background: "var(--accent-soft)" }}
      >
        {enrollmentFinished ? "🎉" : "✓"}
      </div>
      <h2 className="mt-5 text-xl font-bold" style={{ color: "var(--text)" }}>
        {enrollmentFinished ? t("completion.finished") : t("completion.stepDone")}
      </h2>
      {!enrollmentFinished && nextStepUnlocked && (
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          {t("completion.nextUnlocked")}
        </p>
      )}
      <button
        onClick={() => router.push("/dashboard")}
        className="mt-8 rounded-2xl px-6 py-3 text-base font-semibold text-white"
        style={{ background: "var(--accent)" }}
      >
        {t("completion.toDashboard")}
      </button>
    </div>
  );
}
