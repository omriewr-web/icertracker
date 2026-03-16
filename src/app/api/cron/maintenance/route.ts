import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronAuth } from "@/lib/with-cron-auth";

export const dynamic = "force-dynamic";

function advanceDate(date: Date, frequency: string): Date {
  const next = new Date(date);
  switch (frequency) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
    case "ANNUALLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

export const GET = withCronAuth(async () => {
  const now = new Date();
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    // Idempotency guard: skip if already ran in last 23 hours
    const lastRun = await prisma.cronLog.findFirst({
      where: { jobName: "maintenance", status: "COMPLETED" },
      orderBy: { startedAt: "desc" },
    });
    if (lastRun && Date.now() - lastRun.startedAt.getTime() < 23 * 60 * 60 * 1000) {
      return NextResponse.json({ skipped: true, reason: "already ran today" });
    }
    const log = await prisma.cronLog.create({ data: { jobName: "maintenance", status: "RUNNING" } });
    const schedules = await prisma.maintenanceSchedule.findMany({
      where: {
        autoCreateWorkOrder: true,
        nextDueDate: { lte: now },
      },
      include: {
        building: { select: { address: true } },
      },
    });

    for (const schedule of schedules) {
      try {
        // Idempotency: check if a work order was already created for this schedule in the current period
        const existingWO = await prisma.workOrder.findFirst({
          where: {
            sourceType: "schedule",
            sourceId: schedule.id,
            createdAt: { gte: schedule.lastRunDate ?? new Date(0) },
          },
          select: { id: true },
        });

        if (existingWO) {
          // Already created — just advance the schedule
          skipped++;
          await prisma.maintenanceSchedule.update({
            where: { id: schedule.id },
            data: {
              lastRunDate: now,
              nextDueDate: advanceDate(schedule.nextDueDate, schedule.frequency),
            },
          });
          continue;
        }

        // Create work order and advance schedule in a transaction
        await prisma.$transaction(async (tx) => {
          await tx.workOrder.create({
            data: {
              title: schedule.title,
              description: schedule.description || `Scheduled maintenance: ${schedule.title}`,
              status: "OPEN",
              priority: "MEDIUM",
              category: "GENERAL",
              buildingId: schedule.buildingId,
              unitId: schedule.unitId,
              sourceType: "schedule",
              sourceId: schedule.id,
            },
          });

          await tx.maintenanceSchedule.update({
            where: { id: schedule.id },
            data: {
              lastRunDate: now,
              nextDueDate: advanceDate(schedule.nextDueDate, schedule.frequency),
            },
          });
        });

        created++;
      } catch (err: any) {
        errors.push(`Schedule ${schedule.id}: ${err.message}`);
      }
    }

    await prisma.cronLog.update({ where: { id: log.id }, data: { status: "COMPLETED", completedAt: new Date() } });

    return NextResponse.json({
      ok: true,
      schedulesProcessed: schedules.length,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    try { await prisma.cronLog.updateMany({ where: { jobName: "maintenance", status: "RUNNING" }, data: { status: "FAILED", completedAt: new Date(), error: err.message } }); } catch {}
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
});
