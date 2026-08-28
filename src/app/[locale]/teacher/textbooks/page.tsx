"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Upload, FileText, Trash2, Sparkles, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  getSubjects,
  teacherListTextbooks,
  teacherUploadTextbook,
  teacherDeleteTextbook,
  teacherGenerateRoadmap,
  teacherGetGeneration,
  type ApiSubject,
  type ApiTextbook,
} from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ListSkeleton } from "@/components/teacher/ListSkeleton";
import { ErrorBanner } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type T = ReturnType<typeof useTranslations>;
type SetError = (m: string | null) => void;

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function TeacherTextbooksPage() {
  const t = useTranslations();
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [textbooks, setTextbooks] = useState<ApiTextbook[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [subj, tb] = await Promise.all([getSubjects(), teacherListTextbooks()]);
      setSubjects(subj.subjects);
      setTextbooks(tb.textbooks);
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for status while any textbook is still ingesting.
  useEffect(() => {
    if (!textbooks) return;
    const busy = textbooks.some((tb) => tb.status === "uploaded" || tb.status === "processing");
    if (!busy) return;
    const id = setInterval(() => {
      teacherListTextbooks()
        .then((r) => setTextbooks(r.textbooks))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [textbooks]);

  return (
    <TeacherShell>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{t("teacher.kbTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("teacher.kbSubtitle")}</p>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <UploadForm t={t} subjects={subjects} onUploaded={load} onError={setError} />
      <GeneratePanel t={t} subjects={subjects} onError={setError} />

      <h2 className="mb-3 mt-8 text-sm font-semibold text-foreground">{t("teacher.textbooksTitle")}</h2>
      {textbooks === null ? (
        <ListSkeleton />
      ) : textbooks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("teacher.textbooksEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {textbooks.map((tb) => (
            <li key={tb.id}>
              <TextbookRow t={t} tb={tb} onDeleted={load} onError={setError} />
            </li>
          ))}
        </ul>
      )}
    </TeacherShell>
  );
}

function UploadForm({
  t,
  subjects,
  onUploaded,
  onError,
}: {
  t: T;
  subjects: ApiSubject[];
  onUploaded: () => void;
  onError: SetError;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [grade, setGrade] = useState("");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Callers guard on `subjectId` before invoking this.
  async function upload(file: File) {
    setUploading(true);
    onError(null);
    try {
      await teacherUploadTextbook({
        file,
        subjectId,
        title: title || undefined,
        gradeLevel: grade ? Number.parseInt(grade, 10) : null,
      });
      toast.success(t("teacher.uploadDone"));
      setTitle("");
      setGrade("");
      onUploaded();
    } catch (err) {
      onError(errorMessage(t, err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="gap-0 rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-foreground">{t("teacher.uploadTitle")}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="text-sm">
          <Label className="mb-1 text-muted-foreground">{t("teacher.subject")}</Label>
          <select className={SELECT_CLASS} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
            <option value="">—</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm">
          <Label className="mb-1 text-muted-foreground">{t("teacher.gradeLevel")}</Label>
          <Input type="number" min={1} max={12} value={grade} onChange={(e) => setGrade(e.target.value)} />
        </div>
        <div className="text-sm">
          <Label className="mb-1 text-muted-foreground">{t("teacher.textbookTitle")}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          if (!subjectId) {
            onError(t("teacher.pickSubject"));
            return;
          }
          inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (!file) return;
          if (!subjectId) {
            onError(t("teacher.pickSubject"));
            return;
          }
          void upload(file);
        }}
        className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors"
        style={{
          borderColor: dragOver ? "var(--accent)" : "var(--border)",
          background: dragOver ? "var(--accent-soft)" : "var(--surface-muted)",
        }}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
        ) : (
          <Upload className="h-6 w-6" style={{ color: "var(--text-muted)" }} />
        )}
        <span className="text-sm font-medium text-foreground">
          {uploading ? t("teacher.uploading") : t("teacher.uploadPrompt")}
        </span>
        <span className="text-xs text-muted-foreground">{t("teacher.uploadHint")}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
    </Card>
  );
}

function statusBadge(t: T, tb: ApiTextbook) {
  if (tb.status === "ready") return <Badge variant="success">{t("teacher.statusReady")}</Badge>;
  if (tb.status === "processing") return <Badge variant="accent">{t("teacher.statusProcessing")}</Badge>;
  if (tb.status === "failed") return <Badge variant="warning">{t("teacher.statusFailed")}</Badge>;
  return <Badge variant="secondary">{t("teacher.statusUploaded")}</Badge>;
}

function TextbookRow({
  t,
  tb,
  onDeleted,
  onError,
}: {
  t: T;
  tb: ApiTextbook;
  onDeleted: () => void;
  onError: SetError;
}) {
  const [deleting, setDeleting] = useState(false);

  async function del() {
    if (!window.confirm(t("teacher.deleteConfirm"))) return;
    setDeleting(true);
    try {
      await teacherDeleteTextbook(tb.id);
      toast.success(t("teacher.deleted"));
      onDeleted();
    } catch (err) {
      onError(errorMessage(t, err));
      setDeleting(false);
    }
  }

  return (
    <Card className="flex flex-row items-center gap-3 rounded-2xl px-4 py-3">
      <FileText className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{tb.title}</span>
          {statusBadge(t, tb)}
        </div>
        <span className="block text-xs text-muted-foreground">
          {tb.subject.title}
          {tb.grade_level ? ` · ${tb.grade_level}` : ""} · {t("teacher.chunksCount", { n: tb.chunk_count })}
        </span>
        {tb.status === "failed" && tb.error && (
          <span className="block text-xs" style={{ color: "var(--danger)" }}>
            {tb.error}
          </span>
        )}
      </div>
      <Button variant="outline" size="icon" onClick={del} disabled={deleting} aria-label={t("teacher.deleteTextbook")}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </Card>
  );
}

function GeneratePanel({ t, subjects, onError }: { t: T; subjects: ApiSubject[]; onError: SetError }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState("");
  const [grade, setGrade] = useState("");
  const [track, setTrack] = useState<"exam" | "depth">("exam");
  const [generating, setGenerating] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);

  async function generate() {
    if (!subjectId) {
      onError(t("teacher.pickSubject"));
      return;
    }
    setGenerating(true);
    setDraftId(null);
    onError(null);
    try {
      const { generationId } = await teacherGenerateRoadmap({
        subjectId,
        gradeLevel: grade ? Number.parseInt(grade, 10) : null,
        track,
      });
      // Poll the background generation until it finishes.
      const poll = async () => {
        try {
          const s = await teacherGetGeneration(generationId);
          if (s.status === "ready") {
            toast.success(t("teacher.generateSuccess", { n: s.step_count ?? 0 }));
            setDraftId(s.template_id);
            setGenerating(false);
          } else if (s.status === "failed") {
            onError(t("teacher.generateFailed"));
            setGenerating(false);
          } else {
            window.setTimeout(poll, 3000);
          }
        } catch (err) {
          onError(errorMessage(t, err));
          setGenerating(false);
        }
      };
      window.setTimeout(poll, 3000);
    } catch (err) {
      onError(errorMessage(t, err));
      setGenerating(false);
    }
  }

  return (
    <Card className="mt-4 gap-0 rounded-2xl border-2 p-5" style={{ borderColor: "var(--accent)" }}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" style={{ color: "var(--accent-text)" }} />
        <h2 className="text-sm font-semibold text-foreground">{t("teacher.generateTitle")}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t("teacher.generateSubtitle")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <select className={SELECT_CLASS} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">{t("teacher.pickSubject")}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={1}
          max={12}
          placeholder={t("teacher.gradeLevel")}
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
        />
        <select
          className={SELECT_CLASS}
          value={track}
          onChange={(e) => setTrack(e.target.value as "exam" | "depth")}
        >
          <option value="exam">{t("teacher.trackExam")}</option>
          <option value="depth">{t("teacher.trackDepth")}</option>
        </select>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={generate} disabled={generating || !subjectId}>
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {t("teacher.generating")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> {t("teacher.generateButton")}
            </>
          )}
        </Button>
        {draftId && (
          <Button variant="outline" onClick={() => router.push(`/teacher/templates/${draftId}`)}>
            {t("teacher.openDraft")}
          </Button>
        )}
      </div>
    </Card>
  );
}
