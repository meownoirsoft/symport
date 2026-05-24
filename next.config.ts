import type { NextConfig } from "next";

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

export default nextConfig;
