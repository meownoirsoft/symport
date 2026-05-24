import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  devIndicators: false,

  // Don't advertise the tech stack
  poweredByHeader: false,

  // Security headers applied to every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Block framing (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Block MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Only send origin in cross-origin requests
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HSTS — 2 years, include subdomains, eligible for preload
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Disable browser APIs the app doesn't use
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Source map upload — only runs when SENTRY_AUTH_TOKEN is present in the environment.
  // Set SENTRY_ORG, SENTRY_PROJECT, and SENTRY_AUTH_TOKEN in Netlify build env vars
  // to enable source maps for readable stack traces in Sentry.
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Widen the files included when uploading source maps (catches dynamic imports)
  widenClientFileUpload: true,

  // Delete source map files after upload so they aren't served publicly
  sourcemaps: {
    filesToDeleteAfterUpload: [".next/static/**/*.map"],
  },
});
