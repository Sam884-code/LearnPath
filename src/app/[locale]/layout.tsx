import type { Metadata } from "next";
import { Inter, Noto_Sans_Armenian } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "../globals.css";

// Self-hosted (no external request at runtime): Inter for Latin, Noto Sans
// Armenian for Armenian glyphs. Exposed as CSS variables consumed by the font
// stack in globals.css.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const notoArmenian = Noto_Sans_Armenian({
  subsets: ["armenian"],
  variable: "--font-noto-armenian",
  display: "swap",
});

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
    // suppressHydrationWarning: next-themes sets the theme class on <html>
    // before hydration, which would otherwise mismatch the server render.
    <html lang={locale} className={`${inter.variable} ${notoArmenian.variable}`} suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider>
            {children}
            <Toaster richColors position="top-center" />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
