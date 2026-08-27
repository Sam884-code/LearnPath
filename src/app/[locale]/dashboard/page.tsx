"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Lock, ArrowRight } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  ClientApiError,
  getMe,
  getRoadmap,
  logout,
  type ApiRoadmap,
  type ApiRoadmapStep,
} from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { JoinClassCard } from "@/components/classroom/JoinClassCard";

// The student dashboard, recreated from the LearnPath UI handoff (README §5).
// Self-contained blue (#2563eb) + white palette so it matches the mockup exactly
// without touching the app's global (earthy) design tokens. Real data only —
// progress, roadmap steps, review status and JoinClassCard all come from the API.

const serif = "var(--font-noto-serif-armenian), Georgia, serif";

// Design tokens (README "Design Tokens").
const C = {
  text: "#111827",
  text2: "#374151",
  muted: "#6b7280",
  faint: "#9ca3af",
  surface: "#ffffff",
  surface2: "#fafbfc",
  border: "#e5e7eb",
  border2: "#e8eaee",
  border3: "#eef0f2",
  border4: "#f0f1f3",
  hair: "#f1f2f4",
  hair2: "#f4f5f6",
  blue: "#2563eb",
  blueHover: "#1d4ed8",
  blueTint: "#eff6ff",
  blueBorder: "#dbeafe",
  ochreBorder: "#f0dcc4",
  olive: "#606c38",
  oliveText: "#4b5628",
  oliveTint: "#f2f4ea",
  amber: "#b45309",
  amberTint: "#fffbeb",
  rail: "#eceef0",
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | { kind: "ready"; userName: string; roadmap: ApiRoadmap };

type T = ReturnType<typeof useTranslations>;

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
        if (!cancelled) setState({ kind: "ready", userName: me.user.name, roadmap });
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

  if (state.kind === "loading") return <CenteredNote text={t("common.loading")} />;
  if (state.kind === "error") return <CenteredNote text={state.message} tone="error" />;
  if (state.kind === "empty") return <EmptyState t={t} onStart={() => router.replace("/onboarding")} />;

  return <Dashboard t={t} userName={state.userName} roadmap={state.roadmap} onLogout={async () => {
    try { await logout(); } finally { router.replace("/"); }
  }} />;
}

// ---- helpers ----

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

function daysOverdue(due: string): number {
  const diff = Date.now() - new Date(due).getTime();
  return Math.max(1, Math.ceil(diff / 86_400_000));
}

// Explicit Armenian month names — `Intl` with "hy-AM" is unreliable across
// runtimes (falls back to another locale's month names when ICU data is thin).
const HY_MONTHS = [
  "հունվարի", "փետրվարի", "մարտի", "ապրիլի", "մայիսի", "հունիսի",
  "հուլիսի", "օգոստոսի", "սեպտեմբերի", "հոկտեմբերի", "նոյեմբերի", "դեկտեմբերի",
];

function formatDeadline(due: string | null, t: T): string {
  if (!due) return t("dashboard.noDeadline");
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return due.slice(0, 10);
  return `${d.getDate()} ${HY_MONTHS[d.getMonth()]}`;
}

function ctaLabel(step: ApiRoadmapStep, t: T): string {
  if (step.awaiting_review) return t("dashboard.ctaStatus");
  if (step.type === "lesson") return t("dashboard.ctaLesson");
  if (step.type === "quiz") return t("dashboard.ctaQuiz");
  return t("dashboard.ctaAssignment");
}

// ---- shell states ----

function CenteredNote({ text, tone }: { text: string; tone?: "error" }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: C.surface,
        color: tone === "error" ? "#b91c1c" : C.muted,
        fontSize: 14,
        padding: 24,
        textAlign: "center",
      }}
    >
      {text}
    </main>
  );
}

function EmptyState({ t, onStart }: { t: T; onStart: () => void }) {
  return (
    <main style={{ minHeight: "100vh", background: C.surface, color: C.text }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "120px 24px", textAlign: "center" }}>
        <h1 className="dgs-serif" style={{ fontFamily: serif, fontSize: 30, fontWeight: 600 }}>
          {t("dashboard.noEnrollmentTitle")}
        </h1>
        <p style={{ color: C.muted, marginTop: 10 }}>{t("dashboard.noEnrollmentSubtitle")}</p>
        <button
          onClick={onStart}
          style={{
            marginTop: 24,
            background: C.blue,
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "14px 26px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t("dashboard.noEnrollmentAction")}
        </button>
        <div style={{ marginTop: 28, textAlign: "left" }}>
          <JoinClassCard />
        </div>
      </div>
    </main>
  );
}

// ---- dashboard ----

function Dashboard({
  t,
  userName,
  roadmap,
  onLogout,
}: {
  t: T;
  userName: string;
  roadmap: ApiRoadmap;
  onLogout: () => void;
}) {
  const reduce = useReducedMotion();
  const { progress, steps } = roadmap;
  const finished = roadmap.enrollment.completed_at !== null;
  const activeStep = steps.find((s) => s.id === progress.active_step_id) ?? null;
  const trackLabel =
    roadmap.enrollment.track === "exam" ? t("dashboard.trackExamPath") : t("dashboard.trackDepthPath");

  const scored = steps.filter((s) => s.score !== null).map((s) => s.score as number);
  const average = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;

  const rise = reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

  return (
    <main style={{ background: C.surface, color: C.text, minHeight: "100vh", fontSize: 15, lineHeight: 1.6 }}>
      <ScopedStyles />

      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          height: 68,
          background: "rgba(255,255,255,.86)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.border4}`,
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "0 40px",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, letterSpacing: "-.01em", color: C.text }}>
            LearnPath
          </span>
          <div className="dgs-user" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "right", lineHeight: 1.3 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{userName}</div>
              <button
                onClick={onLogout}
                style={{ fontSize: 12, color: C.faint, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {t("dashboard.logout")}
              </button>
            </div>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                background: C.blueTint,
                color: C.blue,
                fontFamily: serif,
                fontWeight: 600,
                fontSize: 13,
                display: "grid",
                placeItems: "center",
              }}
            >
              {initials(userName)}
            </span>
          </div>
        </div>
      </header>

      <div className="dgs-page" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 40px 96px" }}>
        {/* Hero */}
        <motion.div className="dgs-head" {...rise} transition={{ duration: 0.4 }} style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40 }}>
          <div>
            <p style={eyebrow}>{trackLabel}</p>
            <h1 style={{ fontFamily: serif, fontSize: "clamp(30px,6.4vw,44px)", fontWeight: 600, letterSpacing: "-.02em", color: C.text, margin: "6px 0 0", textWrap: "pretty" }}>
              {roadmap.enrollment.subject.title}
            </h1>
            <p style={{ color: C.muted, marginTop: 8 }}>
              {finished
                ? t("dashboard.finishedTitle")
                : activeStep
                  ? t("dashboard.activeStepLine", { title: activeStep.title })
                  : ""}
            </p>
          </div>
          <div className="dgs-stats" style={{ display: "flex", gap: 44 }}>
            <Figure value={`${progress.percent}%`} label={t("dashboard.statProgress")} />
            <Figure value={`${progress.done}/${progress.total}`} label={t("dashboard.statSteps")} />
            <Figure value={average !== null ? `${average}%` : "—"} label={t("dashboard.statAverage")} />
          </div>
        </motion.div>

        {/* Progress card */}
        <motion.div
          {...rise}
          transition={{ duration: 0.4, delay: 0.05 }}
          style={{ border: `1px solid ${C.border3}`, borderRadius: 16, padding: "22px 24px", marginTop: 44, background: C.surface }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontFamily: serif, fontSize: 17, fontWeight: 600, color: C.text }}>
              {t("dashboard.progressLabel")}՝ {progress.percent}% · {progress.done} / {progress.total} {t("dashboard.statSteps").toLowerCase()}
            </span>
            {activeStep && (
              <span style={{ fontSize: 13, color: C.faint }}>
                {t("dashboard.activeStepLabel")}՝ {activeStep.order_index} · {formatDeadline(activeStep.due_date, t)}
              </span>
            )}
          </div>
          <div style={{ marginTop: 14, height: 6, background: C.hair, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress.percent}%`, background: C.blue, borderRadius: 3, transition: "width .6s cubic-bezier(.22,1,.36,1)" }} />
          </div>
        </motion.div>

        {/* Body */}
        <div className="dgs-cols" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 64, marginTop: 44 }}>
          {/* Roadmap */}
          <div style={{ position: "relative" }}>
            <span aria-hidden style={{ position: "absolute", left: 23, top: 34, bottom: 26, width: 1, background: C.rail }} />
            {steps.map((s) => (
              <RoadmapRow key={s.id} step={s} t={t} isActive={s.id === progress.active_step_id} />
            ))}
          </div>

          {/* Right rail */}
          <aside className="dgs-rail" style={{ position: "sticky", top: 92, alignSelf: "start", display: "flex", flexDirection: "column", gap: 20 }}>
            <ReviewList steps={steps} t={t} />
            <JoinClassCard />
          </aside>
        </div>
      </div>
    </main>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: ".11em",
  textTransform: "uppercase",
  color: C.blue,
  margin: 0,
};

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: serif, fontSize: 34, fontWeight: 600, color: C.text, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: C.faint, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Pill({ text, fg, bg }: { text: string; fg: string; bg: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: ".05em",
        textTransform: "uppercase",
        padding: "3px 9px",
        borderRadius: 999,
        color: fg,
        background: bg,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function StepBadge({ step, t }: { step: ApiRoadmapStep; t: T }) {
  if (step.status === "done") return <Pill text={t("dashboard.badgeDone")} fg={C.oliveText} bg={C.oliveTint} />;
  if (step.awaiting_review) return <Pill text={t("dashboard.awaitingReview")} fg={C.blueHover} bg={C.blueTint} />;
  if (step.status === "active" && step.overdue)
    return <Pill text={t("dashboard.overdueDays", { n: step.due_date ? daysOverdue(step.due_date) : 0 })} fg={C.amber} bg={C.amberTint} />;
  return null;
}

function Marker({ step }: { step: ApiRoadmapStep }) {
  const base: React.CSSProperties = {
    width: 34,
    height: 34,
    marginLeft: 6,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    fontFamily: serif,
    fontSize: 13,
    fontWeight: 600,
    position: "relative",
    zIndex: 1,
  };
  if (step.status === "done") {
    return (
      <span style={{ ...base, background: C.olive, color: "#fff" }}>
        <Check size={16} strokeWidth={2.4} aria-hidden />
      </span>
    );
  }
  if (step.status === "active") {
    return (
      <span className="dgs-glow" style={{ ...base, background: C.blue, color: "#fff" }}>
        {step.order_index}
      </span>
    );
  }
  return (
    <span style={{ ...base, background: C.hair2, color: C.faint }}>
      <Lock size={15} strokeWidth={1.8} aria-hidden />
    </span>
  );
}

function RoadmapRow({ step, t, isActive }: { step: ApiRoadmapStep; t: T; isActive: boolean }) {
  const locked = step.status === "locked";
  const done = step.status === "done";
  const titleColor = done ? C.text2 : locked ? C.faint : C.text;

  const meta: string[] = [t(`stepType.${step.type}`)];
  if (done && step.type === "quiz" && step.score !== null) meta.push(t("dashboard.scoreLabel", { score: step.score }));
  else if (isActive) meta.push(step.overdue ? t("dashboard.overdueDays", { n: step.due_date ? daysOverdue(step.due_date) : 0 }) : formatDeadline(step.due_date, t));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 20, padding: "16px 0", opacity: locked ? 0.5 : 1 }}>
      <Marker step={step} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: serif, fontSize: 19, fontWeight: 600, color: titleColor }}>{step.title}</span>
          <StepBadge step={step} t={t} />
        </div>
        <p style={{ fontSize: 13, color: C.faint, marginTop: 4 }}>{meta.join(" · ")}</p>
        {isActive && <ActiveStepCard step={step} t={t} />}
      </div>
    </div>
  );
}

function ActiveStepCard({ step, t }: { step: ApiRoadmapStep; t: T }) {
  const blurb =
    step.type === "lesson"
      ? t("dashboard.blurbLesson")
      : step.type === "quiz"
        ? t("dashboard.blurbQuiz")
        : t("dashboard.blurbAssignment");

  return (
    <div
      className="dgs-glow-ochre"
      style={{ background: "#fff", border: `1px solid ${C.ochreBorder}`, borderRadius: 16, padding: "26px 28px 24px", marginTop: 16 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <p style={eyebrow}>{t("dashboard.activeStepLabel")}</p>
        <StepBadge step={step} t={t} />
      </div>
      <h3 style={{ fontFamily: serif, fontSize: "clamp(22px,4.4vw,27px)", fontWeight: 600, color: C.text, margin: "10px 0 0", textWrap: "pretty" }}>
        {step.title}
      </h3>
      <p style={{ color: C.muted, marginTop: 8 }}>{blurb}</p>
      <div style={{ display: "flex", gap: 22, marginTop: 14, fontSize: 13, color: C.muted, flexWrap: "wrap" }}>
        <span>{t(`stepType.${step.type}`)}</span>
        <span>{step.overdue ? t("dashboard.overdueDays", { n: step.due_date ? daysOverdue(step.due_date) : 0 }) : formatDeadline(step.due_date, t)}</span>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
        <Link
          href={`/steps/${step.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: C.blue,
            color: "#fff",
            borderRadius: 11,
            padding: "13px 22px",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {ctaLabel(step, t)} <ArrowRight size={16} aria-hidden />
        </Link>
        <Link
          href={`/steps/${step.id}`}
          style={{ display: "inline-flex", alignItems: "center", background: "#fff", color: C.text2, border: `1px solid ${C.border}`, borderRadius: 11, padding: "13px 20px", fontSize: 14, fontWeight: 500 }}
        >
          {t("dashboard.downloadMaterials")}
        </Link>
      </div>
    </div>
  );
}

function ReviewList({ steps, t }: { steps: ApiRoadmapStep[]; t: T }) {
  const pending = steps.filter((s) => s.awaiting_review);
  const graded = steps.filter((s) => s.type === "assignment" && s.status === "done" && s.score !== null).slice(-2);

  return (
    <section style={{ border: `1px solid ${C.border3}`, borderRadius: 16, padding: 22, background: C.surface }}>
      <h2 style={{ fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: C.faint, margin: 0 }}>
        {t("dashboard.reviewSectionTitle")}
      </h2>
      {pending.length === 0 && graded.length === 0 ? (
        <p style={{ fontSize: 13, color: C.faint, marginTop: 12 }}>{t("dashboard.reviewEmpty")}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {pending.map((s) => (
            <li key={s.id} style={{ border: `1px solid ${C.border3}`, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: C.text2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.title}
                </span>
                <Pill text={t("dashboard.awaitingReview")} fg={C.blueHover} bg={C.blueTint} />
              </div>
            </li>
          ))}
          {graded.map((s) => (
            <li key={s.id} style={{ paddingTop: 12, borderTop: pending.length ? `1px solid ${C.hair}` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: C.text2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.title}
                </span>
                <Pill text={`${t("dashboard.reviewed")} · ${s.score}`} fg={C.oliveText} bg={C.oliveTint} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Scoped keyframes + responsive rules (README motion/responsive). Prefixed so
// they never collide with the app's global (earthy) styles.
function ScopedStyles() {
  return (
    <style>{`
      @keyframes dgs-glow { 0%,100%{ box-shadow:0 0 0 0 rgba(37,99,235,.22) } 50%{ box-shadow:0 0 0 8px rgba(37,99,235,.08) } }
      @keyframes dgs-glow-ochre { 0%,100%{ box-shadow:0 0 0 0 rgba(188,108,37,.18), 0 24px 48px -36px rgba(17,24,39,.28) } 50%{ box-shadow:0 0 0 8px rgba(188,108,37,.07), 0 26px 50px -34px rgba(17,24,39,.3) } }
      .dgs-glow { animation: dgs-glow 3.4s ease-in-out infinite }
      .dgs-glow-ochre { animation: dgs-glow-ochre 3.8s ease-in-out infinite }
      @media (max-width: 860px) {
        .dgs-page { padding: 32px 20px 72px !important }
        .dgs-cols { grid-template-columns: minmax(0,1fr) !important; gap: 52px !important }
        .dgs-rail { position: static !important }
        .dgs-head { flex-direction: column !important; align-items: flex-start !important; gap: 28px !important }
        .dgs-stats { gap: 28px !important }
        .dgs-user { display: none !important }
      }
      @media (prefers-reduced-motion: reduce) { .dgs-glow, .dgs-glow-ochre { animation: none !important } }
    `}</style>
  );
}
