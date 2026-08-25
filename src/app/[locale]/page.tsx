"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getMe } from "@/lib/api-client";
import { FullScreenLoader } from "@/components/ui";
import { LandingPage } from "@/components/landing/LandingPage";

// Entry point: everyone lands on the marketing page first. Signed-in visitors
// get a "go to app" CTA (pointed at the right place) instead of login/register,
// so they can continue but always see the landing first.
type Auth = { status: "checking" } | { status: "guest" } | { status: "member"; target: string };

export default function Home() {
  const t = useTranslations();
  const [auth, setAuth] = useState<Auth>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        let target = "/dashboard";
        if (me.user.role === "teacher") {
          target = "/teacher";
        } else {
          const hasLiveEnrollment = me.enrollments.some((e) => e.completedAt === null);
          target = hasLiveEnrollment ? "/dashboard" : "/onboarding";
        }
        setAuth({ status: "member", target });
      })
      .catch(() => {
        if (!cancelled) setAuth({ status: "guest" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (auth.status === "checking") return <FullScreenLoader label={t("common.loading")} />;
  return <LandingPage memberTarget={auth.status === "member" ? auth.target : null} />;
}
