import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronAuth } from "@/lib/with-cron-auth";
import { syncAllBuildings } from "@/lib/violation-sync";

export const dynamic = "force-dynamic";

// GET /api/cron/violations — triggered by external scheduler (Vercel Cron, etc.)
// Secured by dedicated CRON_SECRET check via withCronAuth
export const GET = withCronAuth(async () => {
  try {
    // Idempotency guard: skip if already ran in last 23 hours
    const lastRun = await prisma.cronLog.findFirst({
      where: { jobName: "violations", status: "COMPLETED" },
      orderBy: { startedAt: "desc" },
    });
    if (lastRun && Date.now() - lastRun.startedAt.getTime() < 23 * 60 * 60 * 1000) {
      return NextResponse.json({ skipped: true, reason: "already ran today" });
    }
    const log = await prisma.cronLog.create({ data: { jobName: "violations", status: "RUNNING" } });

    const results = await syncAllBuildings();
    const totalNew = results.reduce((sum, r) => sum + r.newCount, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updatedCount, 0);
    const errors = results.filter((r) => r.error);

    await prisma.cronLog.update({ where: { id: log.id }, data: { status: "COMPLETED", completedAt: new Date() } });

    return NextResponse.json({
      ok: true,
      buildingsSynced: results.length,
      totalNew,
      totalUpdated,
      errors: errors.length,
    });
  } catch (err: any) {
    try { await prisma.cronLog.updateMany({ where: { jobName: "violations", status: "RUNNING" }, data: { status: "FAILED", completedAt: new Date(), error: err.message } }); } catch {}
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
});
