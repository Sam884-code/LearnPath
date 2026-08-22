"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { register } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { ErrorBanner, PrimaryButton, Screen, TextField } from "@/components/ui";

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
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
      await register({ name, email, password });
      // A brand-new account never has an enrollment yet — go straight to onboarding.
      router.replace("/onboarding");
    } catch (err) {
      setError(errorMessage(t, err));
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <div className="flex flex-1 flex-col justify-center">
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
      </div>
    </Screen>
  );
}
