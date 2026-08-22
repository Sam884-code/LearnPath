"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { teacherAnswerQuestion, teacherListQuestions, type ApiTeacherQuestion } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ErrorBanner } from "@/components/ui";

type T = ReturnType<typeof useTranslations>;

export default function QuestionsPage() {
  const t = useTranslations();
  const [questions, setQuestions] = useState<ApiTeacherQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function load(all: boolean) {
    setQuestions(null);
    try {
      const res = await teacherListQuestions(all ? "all" : "unanswered");
      setQuestions(res.questions);
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  useEffect(() => {
    load(showAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  return (
    <TeacherShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
          {t("teacher.questionsTitle")}
        </h1>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="rounded border px-3 py-1.5 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          {showAll ? t("teacher.showUnanswered") : t("teacher.showAnswered")}
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {questions === null ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("teacher.loading")}
        </p>
      ) : questions.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("teacher.questionsEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {questions.map((q) => (
            <li key={q.id}>
              <QuestionCard t={t} question={q} onAnswered={() => load(showAll)} onError={setError} />
            </li>
          ))}
        </ul>
      )}
    </TeacherShell>
  );
}

function QuestionCard({
  t,
  question,
  onAnswered,
  onError,
}: {
  t: T;
  question: ApiTeacherQuestion;
  onAnswered: () => void;
  onError: (m: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (answer.trim().length === 0) return;
    setSubmitting(true);
    try {
      await teacherAnswerQuestion(question.id, answer);
      onAnswered();
    } catch (err) {
      onError(errorMessage(t, err));
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {question.student.name} · {question.subject.title}
          {question.step && ` · ${question.step.title}`}
        </span>
      </div>
      <p className="text-sm" style={{ color: "var(--text)" }}>
        {question.body}
      </p>

      {question.answer ? (
        <div className="mt-3 rounded border-l-2 pl-3" style={{ borderColor: "var(--accent)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--accent-text)" }}>
            {t("teacher.answered")}
          </p>
          <p className="text-sm" style={{ color: "var(--text)" }}>
            {question.answer}
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={2}
            placeholder={t("teacher.answerPlaceholder")}
            className="w-full rounded border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
          <button
            type="submit"
            disabled={submitting || answer.trim().length === 0}
            className="self-start rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            {submitting ? t("teacher.saving") : t("teacher.sendAnswer")}
          </button>
        </form>
      )}
    </div>
  );
}
