import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // Capture replays for all sessions that hit an error
  replaysOnErrorSampleRate: 1.0,
  // Capture a small sample of regular sessions
  replaysSessionSampleRate: 0.01,

  integrations: [Sentry.replayIntegration()],
});
