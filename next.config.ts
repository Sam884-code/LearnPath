import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Prisma's client and query engine must not be bundled by the server
  // compiler — keep them external so the native engine resolves at runtime.
  serverExternalPackages: ["@prisma/client", "@aws-sdk/client-s3", "pino", "pdfjs-dist"],
  // Dev-only: lets the app be reached through a tunnel for mobile testing
  // without Next blocking cross-origin dev asset requests. Ignored in
  // production builds. Add your LAN IP here if testing over local Wi-Fi.
  allowedDevOrigins: ["*.trycloudflare.com", "*.loca.lt"],
};

export default withNextIntl(nextConfig);
