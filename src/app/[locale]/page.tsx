"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { getMe } from "@/lib/api-client";
import { FullScreenLoader } from "@/components/ui";
import { LandingPage } from "@/components/landing/LandingPage";

// Entry point: logged-in users are routed to their app; logged-out visitors
// see the marketing landing page.
export default function Home() {
  const router = useRouter();
  const t = useTranslations();
  const [state, setState] = useState<"checking" | "guest">("checking");

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
        // Not signed in → show the landing page rather than jumping to /login.
        if (!cancelled) setState("guest");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "guest") return <LandingPage />;
  return <FullScreenLoader label={t("common.loading")} />;
}
