import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
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

    return NextResponse.json({
      ok: true,
      schedulesProcessed: schedules.length,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
