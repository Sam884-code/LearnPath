"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { register } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { AuthLayout, ChoiceCard, ErrorBanner, PrimaryButton, TextField } from "@/components/ui";

type Role = "student" | "teacher";

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ name, email, password, role });
      // Teachers go to their workspace; new students have no enrollment yet, so
      // they start onboarding.
      router.replace(role === "teacher" ? "/teacher" : "/onboarding");
    } catch (err) {
      setError(errorMessage(t, err));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <header className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          {t("auth.registerTitle")}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          {t("auth.welcomeSubtitle")}
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && <ErrorBanner message={error} />}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-muted-foreground">
              {t("auth.roleQuestion")}
            </legend>
            <ChoiceCard
              icon="🎓"
              title={t("auth.roleStudent")}
              description={t("auth.roleStudentDesc")}
              selected={role === "student"}
              onClick={() => setRole("student")}
            />
            <ChoiceCard
              icon="🧑‍🏫"
              title={t("auth.roleTeacher")}
              description={t("auth.roleTeacherDesc")}
              selected={role === "teacher"}
              onClick={() => setRole("teacher")}
            />
          </fieldset>

          <TextField
            label={t("auth.name")}
            type="text"
            autoComplete="name"
            required
            value={name}
            placeholder={t("auth.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label={t("auth.email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            placeholder={t("auth.emailPlaceholder")}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label={t("auth.password")}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            placeholder={t("auth.passwordPlaceholder")}
            hint={t("auth.passwordHint")}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-2">
            <PrimaryButton type="submit" loading={submitting}>
              {submitting ? t("auth.submitting") : t("auth.registerButton")}
            </PrimaryButton>
          </div>
        </form>

      <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        {t("auth.haveAccountQuestion")}{" "}
        <Link href="/login" className="font-semibold" style={{ color: "var(--accent-text)" }}>
          {t("auth.goToLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}
