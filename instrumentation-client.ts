import * as Sentry from "@sentry/nextjs";

// Guard against duplicate initialization (causes Replay "already initialized" error on /login)
if (!Sentry.getClient()) {
  const isDev = process.env.NODE_ENV === "development";
  const tracesSampleRate = isDev ? 1.0 : 0.1;
  const environment =
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    "development";

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
    environment,
    debug: isDev,
    sendDefaultPii: true,
    tracesSampleRate,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    enableLogs: isDev,
    integrations: [
      Sentry.replayIntegration(),
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
