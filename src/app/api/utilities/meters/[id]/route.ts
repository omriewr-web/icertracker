import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { canAccessBuilding } from "@/lib/data-scope";
import { parseBody } from "@/lib/api-helpers";
import { utilityMeterUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const meter = await prisma.utilityMeter.findUnique({
    where: { id },
    include: {
      building: { select: { id: true, address: true } },
      unit: {
        select: {
          id: true, unitNumber: true, isVacant: true,
          tenant: { select: { id: true, name: true, leaseExpiration: true, moveOutDate: true, leaseStatus: true } },
        },
      },
      accounts: {
        include: {
          tenant: { select: { id: true, name: true, leaseExpiration: true, moveOutDate: true, leaseStatus: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!meter) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, meter.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(meter);
}, "utilities");

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const existing = await prisma.utilityMeter.findUnique({
    where: { id },
    select: { buildingId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, existing.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { utilityType, providerName, meterNumber, serviceAddress, isActive, notes, unitId } = await parseBody(req, utilityMeterUpdateSchema);

  const meter = await prisma.utilityMeter.update({
    where: { id },
    data: {
      ...(utilityType !== undefined && { utilityType }),
      ...(providerName !== undefined && { providerName }),
      ...(meterNumber !== undefined && { meterNumber }),
      ...(serviceAddress !== undefined && { serviceAddress }),
      ...(isActive !== undefined && { isActive }),
      ...(notes !== undefined && { notes }),
      ...(unitId !== undefined && { unitId: unitId || null }),
    },
  });

  return NextResponse.json(meter);
}, "utilities");

export const DELETE = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const existing = await prisma.utilityMeter.findUnique({
    where: { id },
    select: { buildingId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, existing.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.utilityMeter.delete({ where: { id } });
  return NextResponse.json({ success: true });
}, "utilities");
