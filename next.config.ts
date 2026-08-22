import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Prisma's client and query engine must not be bundled by the server
  // compiler — keep them external so the native engine resolves at runtime.
  serverExternalPackages: ["@prisma/client", "@aws-sdk/client-s3"],
};

export default withNextIntl(nextConfig);
