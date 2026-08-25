import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Armenian-only app. English was removed; legacy /en/* URLs are redirected
  // to /hy/* in middleware.
  locales: ["hy"],
  defaultLocale: "hy",
});