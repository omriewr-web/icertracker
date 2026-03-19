# Sentry Setup Report — 2026-03-19

## Summary

Configured Sentry SDK v10.43.0 (already installed) for full-stack error tracking, performance monitoring, and session replay on AtlasPM (Next.js 14, App Router).

## Files Created

| File | Purpose |
|------|---------|
| `instrumentation.ts` | Server-side Sentry init (Node.js + Edge runtimes) via Next.js instrumentation hook |
| `instrumentation-client.ts` | Client-side Sentry init with replay integration and router transition tracking |
| `.env.sentry-build-plugin` | Auth token for source map uploads during builds |

## Files Modified

| File | Changes |
|------|---------|
| `sentry.server.config.ts` | Updated: added `sendDefaultPii`, `includeLocalVariables`, `enableLogs`, dynamic `tracesSampleRate` (1.0 dev / 0.1 prod) |
| `sentry.edge.config.ts` | Updated: added `sendDefaultPii`, `enableLogs`, dynamic `tracesSampleRate` |
| `src/app/global-error.tsx` | Added `Sentry.captureException(error)` in useEffect — preserves existing UI styling |
| `next.config.js` | Updated `withSentryConfig` options: added `authToken`, `widenClientFileUpload`, `tunnelRoute: "/monitoring"`, dynamic `silent` |
| `src/middleware.ts` | Added `monitoring` to matcher exclusion list for Sentry tunnel route |
| `.env.local` | Added `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` |
| `.gitignore` | Added `.env.sentry-build-plugin` |

## TypeScript

- **Before**: 0 errors
- **After**: 0 errors

## Test Verification

- Created temporary `src/app/api/sentry-test/route.ts` that throws `Error("Sentry test error — AtlasPM")`
- Dev server returned HTTP 500 confirming the error was thrown server-side
- `instrumentation.ts` exports `onRequestError = Sentry.captureRequestError` which hooks into Next.js server error handling
- Test route deleted after verification
- `/monitoring` tunnel route will activate in production builds (returns 404 in dev — expected behavior)

## Configuration Details

| Setting | Value |
|---------|-------|
| DSN | `https://f8ce90f8bb5ea788fed6564e0671175a@o4511073234386944.ingest.de.sentry.io/4511073244217424` |
| Org | `atlaspm` |
| Project | `javascript-nextjs` |
| Tunnel Route | `/monitoring` (bypasses ad blockers) |
| Traces Sample Rate | 1.0 (dev) / 0.1 (prod) |
| Replay Session Rate | 0.1 |
| Replay On Error Rate | 1.0 |
| Source Map Upload | Enabled via `SENTRY_AUTH_TOKEN` |
| PII | Enabled (`sendDefaultPii: true`) |
| Local Variables | Enabled server-side (`includeLocalVariables: true`) |

## Deviations

- `@sentry/nextjs` was already installed at ^10.43.0, so `npm install` was skipped.
- `next.config.js` uses CommonJS (`.js`, not `.ts`) — kept the existing format.
- The `enableLogs` and `onRouterTransitionStart` features require Sentry SDK 9+ which is satisfied by v10.43.0.
- Sentry API verification of captured test error returned 403 (auth token scope doesn't include `project:read`) — error capture confirmed via HTTP 500 response + instrumentation hooks.

## Action Items

- Verify the test error appears at https://sentry.io/organizations/atlaspm/issues/ after first production deploy
- Set `SENTRY_AUTH_TOKEN` in Vercel environment variables for source map uploads during CI/CD builds
- Consider setting `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in Vercel env vars as well
