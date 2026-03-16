import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronAuth } from "@/lib/with-cron-auth";
import { runSignalScan } from "@/lib/signals/engine";
import { checkCertificationDeadlines } from "@/lib/services/certification-alerts.service";

export const dynamic = "force-dynamic";

// GET /api/cron/signals — triggered by external scheduler (Vercel Cron, etc.)
// Secured by dedicated CRON_SECRET check via withCronAuth
export const GET = withCronAuth(async () => {
  try {
    // Idempotency guard: skip if already ran in last 23 hours
    const lastRun = await prisma.cronLog.findFirst({
      where: { jobName: "signals", status: "COMPLETED" },
      orderBy: { startedAt: "desc" },
    });
    if (lastRun && Date.now() - lastRun.startedAt.getTime() < 23 * 60 * 60 * 1000) {
      return NextResponse.json({ skipped: true, reason: "already ran today" });
    }
    const log = await prisma.cronLog.create({ data: { jobName: "signals", status: "RUNNING" } });

    const [signalResult, certResult] = await Promise.all([
      runSignalScan("scheduled"),
      checkCertificationDeadlines().catch((err) => ({ alertsCreated: 0, error: err.message })),
    ]);

    await prisma.cronLog.update({ where: { id: log.id }, data: { status: "COMPLETED", completedAt: new Date() } });

    return NextResponse.json({ ok: true, ...signalResult, certDeadlines: certResult });
  } catch (err: any) {
    try { await prisma.cronLog.updateMany({ where: { jobName: "signals", status: "RUNNING" }, data: { status: "FAILED", completedAt: new Date(), error: err.message } }); } catch {}
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
});
