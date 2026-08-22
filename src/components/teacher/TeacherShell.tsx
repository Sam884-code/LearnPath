"use client";

import { ReactNode, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { getMe, logout } from "@/lib/api-client";

// Desktop-first shell for the teacher area: a top nav plus a role guard. Plainer
// than the student UI by design — teachers work on laptops.
export function TeacherShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        if (me.user.role !== "teacher") {
          router.replace(me.user.role === "student" ? "/dashboard" : "/login");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const nav = [
    { href: "/teacher/templates", label: t("teacher.templates") },
    { href: "/teacher/grading", label: t("teacher.grading") },
    { href: "/teacher/stuck", label: t("teacher.stuck") },
    { href: "/teacher/questions", label: t("teacher.questions") },
  ];

  async function onLogout() {
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
        {t("teacher.loading")}
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <span className="mr-2 text-sm font-bold" style={{ color: "var(--text)" }}>
            {t("teacher.nav")}
          </span>
          <nav className="flex flex-1 flex-wrap gap-x-5 gap-y-1 text-sm">
            {nav.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="font-medium"
                  style={{ color: active ? "var(--accent-text)" : "var(--text-muted)" }}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <button onClick={onLogout} className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t("teacher.logout")}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
