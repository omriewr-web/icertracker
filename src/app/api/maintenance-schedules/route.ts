import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { maintenanceScheduleSchema } from "@/lib/validations";
import { getBuildingScope, EMPTY_SCOPE, assertBuildingAccess } from "@/lib/data-scope";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const scope = getBuildingScope(user);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const where: any = { ...scope };

  const schedules = await prisma.maintenanceSchedule.findMany({
    where,
    include: {
      building: { select: { address: true } },
      unit: { select: { unitNumber: true } },
    },
    orderBy: { nextDueDate: "asc" },
    take: 200,
  });

  return NextResponse.json(schedules);
}, "maintenance");

export const POST = withAuth(async (req, { user }) => {
  const data = await parseBody(req, maintenanceScheduleSchema);

  // Verify building access
  const accessErr = await assertBuildingAccess(user, data.buildingId);
  if (accessErr) return accessErr;

  const schedule = await prisma.maintenanceSchedule.create({
    data: {
      title: data.title,
      description: data.description,
      frequency: data.frequency as any,
      nextDueDate: new Date(data.nextDueDate),
      autoCreateWorkOrder: data.autoCreateWorkOrder,
      buildingId: data.buildingId,
      unitId: data.unitId || null,
    },
    include: {
      building: { select: { address: true } },
      unit: { select: { unitNumber: true } },
    },
  });

  return NextResponse.json(schedule, { status: 201 });
}, "maintenance");
