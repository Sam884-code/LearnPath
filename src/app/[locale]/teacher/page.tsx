"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

export default function TeacherHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/teacher/templates");
  }, [router]);
  return null;
}
