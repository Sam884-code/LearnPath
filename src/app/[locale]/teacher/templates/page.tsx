"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  getSubjects,
  teacherCreateTemplate,
  teacherListTemplates,
  type ApiSubject,
  type ApiTemplateSummary,
} from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ErrorBanner } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function TeacherTemplatesPage() {
  const t = useTranslations();
  const router = useRouter();
  const [templates, setTemplates] = useState<ApiTemplateSummary[] | null>(null);
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try {
      const [tpl, subj] = await Promise.all([teacherListTemplates(), getSubjects()]);
      setTemplates(tpl.templates);
      setSubjects(subj.subjects);
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{t("teacher.templatesTitle")}</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{t("teacher.newTemplate")}</Button>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {showForm && (
        <CreateTemplateForm
          t={t}
          subjects={subjects}
          onCreated={(id) => router.push(`/teacher/templates/${id}`)}
          onError={setError}
        />
      )}

      {templates === null ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("teacher.loading")}
        </p>
      ) : templates.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("teacher.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map((tpl) => (
            <li key={tpl.id}>
              <Link href={`/teacher/templates/${tpl.id}`} className="block">
                <Card className="flex flex-row items-center gap-4 rounded-2xl px-4 py-3 transition-shadow hover:shadow-md">
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-foreground">{tpl.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {tpl.subject.title} · {t(tpl.track === "exam" ? "teacher.trackExam" : "teacher.trackDepth")} ·{" "}
                      {t("teacher.stepsCount", { n: tpl.steps.length })}
                    </span>
                  </span>
                  <Badge variant={tpl.isPublished ? "success" : "secondary"}>
                    {tpl.isPublished ? t("teacher.published") : t("teacher.draft")}
                  </Badge>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </TeacherShell>
  );
}

type T = ReturnType<typeof useTranslations>;

function CreateTemplateForm({
  t,
  subjects,
  onCreated,
  onError,
}: {
  t: T;
  subjects: ApiSubject[];
  onCreated: (id: string) => void;
  onError: (m: string) => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [track, setTrack] = useState<"exam" | "depth">("exam");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subjectId) return;
    setSubmitting(true);
    try {
      const res = await teacherCreateTemplate({ subject_id: subjectId, track, title, description });
      onCreated(res.template.id);
    } catch (err) {
      onError(errorMessage(t, err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
      <div className="text-sm">
        <Label className="mb-1 text-muted-foreground">{t("teacher.subject")}</Label>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          required
          className={SELECT_CLASS}
        >
          <option value="">—</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
      <div className="text-sm">
        <Label className="mb-1 text-muted-foreground">{t("teacher.track")}</Label>
        <select
          value={track}
          onChange={(e) => setTrack(e.target.value as "exam" | "depth")}
          className={SELECT_CLASS}
        >
          <option value="exam">{t("teacher.trackExam")}</option>
          <option value="depth">{t("teacher.trackDepth")}</option>
        </select>
      </div>
      <div className="text-sm sm:col-span-2">
        <Label className="mb-1 text-muted-foreground">{t("teacher.templateTitle")}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="text-sm sm:col-span-2">
        <Label className="mb-1 text-muted-foreground">{t("teacher.templateDescription")}</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={submitting || !subjectId}>
          {submitting ? t("teacher.saving") : t("teacher.createTemplate")}
        </Button>
      </div>
    </form>
  );
}

// Native <select> styled to match shadcn Input (shadcn has no Select installed).
const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
