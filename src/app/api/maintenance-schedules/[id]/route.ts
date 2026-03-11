import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { maintenanceScheduleSchema } from "@/lib/validations";

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const data = await parseBody(req, maintenanceScheduleSchema.partial());

  const existing = await prisma.maintenanceSchedule.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: any = { ...data };
  if (data.nextDueDate) {
    updateData.nextDueDate = new Date(data.nextDueDate);
  }

  const schedule = await prisma.maintenanceSchedule.update({
    where: { id },
    data: updateData,
    include: {
      building: { select: { address: true } },
      unit: { select: { unitNumber: true } },
    },
  });

  return NextResponse.json(schedule);
}, "maintenance");

export const DELETE = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const existing = await prisma.maintenanceSchedule.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.maintenanceSchedule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}, "maintenance");
