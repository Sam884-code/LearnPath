"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { getMyClassrooms, joinClassroom, type ApiStudentClassroom } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Lets a student join a teacher's class with a short code, and shows the classes
// they're already in. Rendered on the dashboard.
export function JoinClassCard() {
  const t = useTranslations();
  const [classes, setClasses] = useState<ApiStudentClassroom[] | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMyClassrooms()
      .then((res) => setClasses(res.classrooms))
      .catch(() => setClasses([])); // non-fatal: just show the join form
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (code.trim().length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await joinClassroom(code.trim());
      toast.success(t("classroom.joinedToast", { teacher: res.teacher.name }));
      setCode("");
      const mine = await getMyClassrooms();
      setClasses(mine.classrooms);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="gap-0 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4" style={{ color: "var(--accent-text)" }} />
        <h2 className="text-sm font-semibold text-foreground">{t("classroom.joinTitle")}</h2>
      </div>

      {classes && classes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {classes.map((c) => (
            <li key={c.id} className="text-sm text-muted-foreground">
              {t("classroom.inClass", { teacher: c.teacher.name })}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-muted-foreground">{t("classroom.joinSubtitle")}</p>
      <form onSubmit={onSubmit} className="mt-2 flex items-center gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t("classroom.joinPlaceholder")}
          className="font-mono uppercase tracking-widest"
          maxLength={16}
          autoCapitalize="characters"
          autoCorrect="off"
        />
        <Button type="submit" disabled={submitting || code.trim().length === 0}>
          {submitting ? t("classroom.joining") : t("classroom.joinButton")}
        </Button>
      </form>
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </Card>
  );
}
