"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";

// Light/dark toggle. Renders a stable placeholder until mounted to avoid a
// hydration mismatch (the resolved theme is only known on the client).
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={t("common.toggleTheme")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${className ?? ""}`}
      style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}
    >
      {mounted && isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
