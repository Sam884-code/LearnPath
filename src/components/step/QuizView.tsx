"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  askMentorQuestion,
  getQuiz,
  submitQuiz,
  ClientApiError,
  type ApiQuiz,
  type ApiStepDetail,
  type SubmitQuizResult,
} from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { ErrorBanner, PrimaryButton, ProgressDots, Skeleton } from "@/components/ui";
import { MaterialsList, StepHeader } from "./shared";

type T = ReturnType<typeof useTranslations>;

type Phase = "loading" | "answering" | "review" | "result" | "noAttempts";

export function QuizView({ step }: { step: ApiStepDetail }) {
  const t = useTranslations();
  const router = useRouter();

  const attemptsExhausted = step.max_attempts !== null && step.attempts >= step.max_attempts;

  const [phase, setPhase] = useState<Phase>(attemptsExhausted ? "noAttempts" : "loading");
  const [quiz, setQuiz] = useState<ApiQuiz | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SubmitQuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (phase !== "loading") return;
    let cancelled = false;
    getQuiz(step.id)
      .then((q) => {
        if (cancelled) return;
        setQuiz(q);
        setPhase("answering");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorMessage(t, err));
      });
    return () => {
      cancelled = true;
    };
  }, [phase, step.id, t]);

  async function doSubmit() {
    if (!quiz) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload = quiz.questions.map((q) => ({ question_id: q.id, chosen_index: answers[q.id] }));
      const res = await submitQuiz(step.id, payload);
      setResult(res);
      setPhase("result");
    } catch (err) {
      if (err instanceof ClientApiError && err.code === "NO_ATTEMPTS_LEFT") {
        setPhase("noAttempts");
      } else {
        setError(errorMessage(t, err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setAnswers({});
    setIndex(0);
    setResult(null);
    setPhase("answering");
  }

  if (phase === "noAttempts") {
    return <NoAttemptsLeft t={t} step={step} />;
  }

  if (phase === "result" && result) {
    return <QuizResult t={t} quiz={quiz!} result={result} step={step} onRetry={retry} onContinue={() => router.push("/dashboard")} />;
  }

  return (
    <>
      <StepHeader t={t} orderIndex={step.order_index} type="quiz" title={step.title} overdue={step.overdue} />

      <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
        {t("quiz.passScore", { score: step.pass_score })}
        {step.max_attempts !== null && ` · ${t("quiz.attemptsCount", { current: step.attempts + 1, max: step.max_attempts })}`}
      </p>

      {phase === "loading" || !quiz ? (
        <QuizSkeleton />
      ) : phase === "review" ? (
        <ReviewScreen
          t={t}
          quiz={quiz}
          answers={answers}
          submitting={submitting}
          error={error}
          onEdit={(i) => {
            setIndex(i);
            setPhase("answering");
          }}
          onBack={() => {
            setIndex(quiz.questions.length - 1);
            setPhase("answering");
          }}
          onSubmit={doSubmit}
        />
      ) : (
        <QuestionScreen
          t={t}
          quiz={quiz}
          index={index}
          answers={answers}
          onChoose={(qid, oi) => setAnswers((a) => ({ ...a, [qid]: oi }))}
          onPrev={() => setIndex((i) => Math.max(0, i - 1))}
          onNext={() => {
            if (index < quiz.questions.length - 1) setIndex((i) => i + 1);
            else setPhase("review");
          }}
        />
      )}
    </>
  );
}

function QuestionScreen({
  t,
  quiz,
  index,
  answers,
  onChoose,
  onPrev,
  onNext,
}: {
  t: T;
  quiz: ApiQuiz;
  index: number;
  answers: Record<string, number>;
  onChoose: (qid: string, oi: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const q = quiz.questions[index];
  const answered = answers[q.id] !== undefined;
  const isLast = index === quiz.questions.length - 1;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <ProgressDots total={quiz.questions.length} current={index + 1} />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {t("quiz.questionCount", { current: index + 1, total: quiz.questions.length })}
        </span>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="mb-4 text-base font-semibold" style={{ color: "var(--text)" }}>
          {q.text}
        </p>
        <div className="flex flex-col gap-2">
          {q.options.map((opt, oi) => {
            const selected = answers[q.id] === oi;
            return (
              <button
                key={oi}
                onClick={() => onChoose(q.id, oi)}
                className="rounded-xl border-2 px-4 py-3 text-left text-sm transition-colors"
                style={{
                  borderColor: selected ? "var(--accent)" : "var(--border)",
                  background: selected ? "var(--accent-soft)" : "var(--surface)",
                  color: "var(--text)",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="rounded-2xl border px-5 py-3 text-sm font-medium disabled:opacity-40"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          {t("quiz.previous")}
        </button>
        <button
          onClick={onNext}
          disabled={!answered}
          className="flex-1 rounded-2xl px-5 py-3 text-base font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          {isLast ? t("quiz.toReview") : t("quiz.next")}
        </button>
      </div>
    </div>
  );
}

function ReviewScreen({
  t,
  quiz,
  answers,
  submitting,
  error,
  onEdit,
  onBack,
  onSubmit,
}: {
  t: T;
  quiz: ApiQuiz;
  answers: Record<string, number>;
  submitting: boolean;
  error: string | null;
  onEdit: (index: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined);

  return (
    <div>
      <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>
        {t("quiz.reviewTitle")}
      </h2>
      <p className="mb-4 mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        {t("quiz.reviewHint")}
      </p>

      <ul className="flex flex-col gap-2">
        {quiz.questions.map((q, i) => {
          const chosen = answers[q.id];
          const answered = chosen !== undefined;
          return (
            <li key={q.id}>
              <button
                onClick={() => onEdit(i)}
                className="w-full rounded-xl border px-4 py-3 text-left"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <span className="block text-sm font-medium" style={{ color: "var(--text)" }}>
                  {i + 1}. {q.text}
                </span>
                <span
                  className="mt-1 block text-xs"
                  style={{ color: answered ? "var(--accent-text)" : "var(--danger)" }}
                >
                  {answered ? q.options[chosen] : t("quiz.unanswered")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-2xl border px-5 py-3 text-sm font-medium"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          {t("quiz.previous")}
        </button>
        <button
          onClick={onSubmit}
          disabled={!allAnswered || submitting}
          className="flex-1 rounded-2xl px-5 py-3 text-base font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          {submitting ? t("quiz.submitting") : t("quiz.submit")}
        </button>
      </div>
    </div>
  );
}

function QuizResult({
  t,
  quiz,
  result,
  step,
  onRetry,
  onContinue,
}: {
  t: T;
  quiz: ApiQuiz;
  result: SubmitQuizResult;
  step: ApiStepDetail;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const byId = new Map(result.results.map((r) => [r.question_id, r]));
  // Failed and no attempts remaining → surface the no-attempts state instead of a dead-end.
  const exhausted = result.attempts_left === 0;

  return (
    <>
      <StepHeader t={t} orderIndex={step.order_index} type="quiz" title={step.title} />

      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: result.passed ? "var(--accent-soft)" : "var(--danger-soft)" }}
      >
        <p className="text-3xl font-bold" style={{ color: result.passed ? "var(--accent-text)" : "var(--danger)" }}>
          {result.score}%
        </p>
        <p className="mt-1 text-sm font-semibold" style={{ color: result.passed ? "var(--accent-text)" : "var(--danger)" }}>
          {result.passed ? t("quiz.passed") : t("quiz.failed")}
        </p>
      </div>

      <ul className="mt-5 flex flex-col gap-3">
        {quiz.questions.map((q) => {
          const r = byId.get(q.id);
          const correct = r?.correct ?? false;
          return (
            <li
              key={q.id}
              className="rounded-xl border p-4"
              style={{
                borderColor: correct ? "var(--accent)" : "var(--danger)",
                background: "var(--surface)",
              }}
            >
              <div className="flex items-start gap-2">
                <span aria-hidden>{correct ? "✓" : "✕"}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {q.text}
                  </p>
                  {r && (
                    <p className="mt-1 text-xs" style={{ color: "var(--accent-text)" }}>
                      {q.options[r.correct_index]}
                    </p>
                  )}
                  {r?.explanation && (
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      {r.explanation}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6">
        {result.passed ? (
          <PrimaryButton onClick={onContinue}>{t("quiz.continue")}</PrimaryButton>
        ) : exhausted ? (
          <NoAttemptsLeft t={t} step={step} embedded />
        ) : (
          <PrimaryButton onClick={onRetry}>{t("quiz.retry")}</PrimaryButton>
        )}
      </div>
    </>
  );
}

// SPEC.md §4: attempts exhausted → never hard-lock. Re-surface the materials
// and, if the student opted into mentor Q&A, a prompt to ask their teacher.
function NoAttemptsLeft({ t, step, embedded }: { t: T; step: ApiStepDetail; embedded?: boolean }) {
  return (
    <div>
      {!embedded && <StepHeader t={t} orderIndex={step.order_index} type="quiz" title={step.title} />}

      <div className="rounded-2xl p-5" style={{ background: "var(--danger-soft)" }}>
        <p className="font-semibold" style={{ color: "var(--danger)" }}>
          {t("quiz.noAttemptsTitle")}
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--danger)" }}>
          {t("quiz.noAttemptsBody")}
        </p>
      </div>

      <MaterialsList t={t} materials={step.materials} />

      {step.wants_mentor_qa && <MentorPrompt t={t} enrollmentId={step.enrollment_id} userStepId={step.id} />}
    </div>
  );
}

function MentorPrompt({ t, enrollmentId, userStepId }: { t: T; enrollmentId: string; userStepId: string }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    setSending(true);
    try {
      await askMentorQuestion(enrollmentId, body, userStepId);
      setSent(true);
    } catch (err) {
      setError(errorMessage(t, err));
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-2xl p-5" style={{ background: "var(--accent-soft)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--accent-text)" }}>
          {t("quiz.mentorSent")}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="mb-3 text-sm font-medium" style={{ color: "var(--text)" }}>
        {t("quiz.askMentorPrompt")}
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("quiz.askMentorPlaceholder")}
        rows={3}
        className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
        style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
      />
      {error && (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}
      <button
        onClick={send}
        disabled={body.trim().length === 0 || sending}
        className="mt-3 w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: "var(--accent)" }}
      >
        {sending ? t("quiz.askMentorSending") : t("quiz.askMentorSend")}
      </button>
    </div>
  );
}

function QuizSkeleton() {
  return (
    <div>
      <Skeleton className="mb-5 h-2 w-40" radius={6} />
      <Skeleton className="h-52 w-full" radius={16} />
      <div className="mt-6">
        <Skeleton className="h-12 w-full" radius={16} />
      </div>
    </div>
  );
}
