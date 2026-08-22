"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { getMe } from "@/lib/api-client";
import { FullScreenLoader } from "@/components/ui";

// Entry point: sends the user to the right place based on their session.
export default function Home() {
  const router = useRouter();
  const t = useTranslations();

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        if (me.user.role === "teacher") {
          router.replace("/teacher");
          return;
        }
        const hasLiveEnrollment = me.enrollments.some((e) => e.completedAt === null);
        router.replace(hasLiveEnrollment ? "/dashboard" : "/onboarding");
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return <FullScreenLoader label={t("common.loading")} />;
}
