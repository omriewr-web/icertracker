import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  captureSentryException,
  captureSlowRoute,
  startObservedServerSpan,
} from "./sentry-observability";

type CronHandler = (req: NextRequest) => Promise<NextResponse | Response>;

/**
 * Dedicated auth wrapper for cron endpoints.
 * Only checks CRON_SECRET — no session, no role escalation.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function withCronAuth(handler: CronHandler) {
  return async (req: NextRequest) => {
    const route = new URL(req.url).pathname;
    const method = req.method;
    const requestId = req.headers.get("x-request-id") ?? `cron_${Date.now()}`;
    const startedAt = Date.now();
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const provided = req.headers.get("authorization")?.replace("Bearer ", "") || "";
    const secretBuf = Buffer.from(cronSecret);
    const providedBuf = Buffer.from(provided);

    if (secretBuf.length !== providedBuf.length || !timingSafeEqual(secretBuf, providedBuf)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const response = await startObservedServerSpan(`${method} ${route}`, "cron", () =>
        Promise.resolve(handler(req)),
      );

      captureSlowRoute({
        route,
        method,
        durationMs: Date.now() - startedAt,
        requestId,
      });

      return response;
    } catch (error) {
      captureSentryException(error, {
        tags: {
          route,
          method,
          requestId,
          authType: "cron",
        },
        fingerprint: ["cron-error", method, route],
      });

      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
