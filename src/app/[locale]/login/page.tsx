"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { login, getMe } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { AuthLayout, ErrorBanner, PrimaryButton, TextField } from "@/components/ui";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      // After login, route by role, then by whether a live enrollment exists.
      const me = await getMe();
      if (me.user.role === "teacher") {
        router.replace("/teacher");
        return;
      }
      const hasLiveEnrollment = me.enrollments.some((en) => en.completedAt === null);
      router.replace(hasLiveEnrollment ? "/dashboard" : "/onboarding");
    } catch (err) {
      setError(errorMessage(t, err));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <header className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          {t("auth.loginTitle")}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          {t("auth.welcomeSubtitle")}
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && <ErrorBanner message={error} />}
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
            autoComplete="current-password"
            required
            value={password}
            placeholder={t("auth.passwordPlaceholder")}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-2">
            <PrimaryButton type="submit" loading={submitting}>
              {submitting ? t("auth.submitting") : t("auth.loginButton")}
            </PrimaryButton>
          </div>
        </form>

      <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        {t("auth.noAccountQuestion")}{" "}
        <Link href="/register" className="font-semibold" style={{ color: "var(--accent-text)" }}>
          {t("auth.goToRegister")}
        </Link>
      </p>
    </AuthLayout>
  );
}
