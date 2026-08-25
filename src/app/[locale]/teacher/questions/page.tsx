"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { teacherAnswerQuestion, teacherListQuestions, type ApiTeacherQuestion } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ListSkeleton } from "@/components/teacher/ListSkeleton";
import { ErrorBanner } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
        <h1 className="text-xl font-bold text-foreground">{t("teacher.questionsTitle")}</h1>
        <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? t("teacher.showUnanswered") : t("teacher.showAnswered")}
        </Button>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {questions === null ? (
        <ListSkeleton />
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
      toast.success(t("teacher.answered"));
      onAnswered();
    } catch (err) {
      onError(errorMessage(t, err));
      setSubmitting(false);
    }
  }

  return (
    <Card className="gap-0 rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {question.student.name} · {question.subject.title}
          {question.step && ` · ${question.step.title}`}
        </span>
      </div>
      <p className="text-sm text-foreground">{question.body}</p>

      {question.answer ? (
        <div className="mt-3 rounded border-l-2 pl-3" style={{ borderColor: "var(--accent)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--accent-text)" }}>
            {t("teacher.answered")}
          </p>
          <p className="text-sm text-foreground">{question.answer}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={2}
            placeholder={t("teacher.answerPlaceholder")}
          />
          <Button type="submit" size="sm" className="self-start" disabled={submitting || answer.trim().length === 0}>
            {submitting ? t("teacher.saving") : t("teacher.sendAnswer")}
          </Button>
        </form>
      )}
    </Card>
  );
}
