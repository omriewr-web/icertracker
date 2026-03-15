import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

type CronHandler = (req: NextRequest) => Promise<NextResponse | Response>;

/**
 * Dedicated auth wrapper for cron endpoints.
 * Only checks CRON_SECRET — no session, no role escalation.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function withCronAuth(handler: CronHandler) {
  return async (req: NextRequest) => {
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

    return handler(req);
  };
}
