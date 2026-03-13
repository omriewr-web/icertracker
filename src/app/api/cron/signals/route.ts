import { NextRequest, NextResponse } from "next/server";
import { withCronAuth } from "@/lib/with-cron-auth";
import { runSignalScan } from "@/lib/signals/engine";
import { checkCertificationDeadlines } from "@/lib/services/certification-alerts.service";

export const dynamic = "force-dynamic";

// GET /api/cron/signals — triggered by external scheduler (Vercel Cron, etc.)
// Secured by dedicated CRON_SECRET check via withCronAuth
export const GET = withCronAuth(async () => {
  try {
    const [signalResult, certResult] = await Promise.all([
      runSignalScan("scheduled"),
      checkCertificationDeadlines().catch((err) => ({ alertsCreated: 0, error: err.message })),
    ]);
    return NextResponse.json({ ok: true, ...signalResult, certDeadlines: certResult });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
});
