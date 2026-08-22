import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Metadata copy comes from messages/hy.json (app.name / app.tagline) rather
// than being hardcoded here, so all user-facing text stays in one translated
// place.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });
  return { title: t("name"), description: t("tagline") };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale}>
      <body className="min-h-screen">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
