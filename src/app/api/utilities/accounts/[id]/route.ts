import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { canAccessBuilding } from "@/lib/data-scope";
import { utilityAccountUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const account = await prisma.utilityAccount.findUnique({
    where: { id },
    include: {
      meter: { select: { buildingId: true, utilityType: true, meterNumber: true, building: { select: { address: true } } } },
      tenant: { select: { id: true, name: true } },
    },
  });

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, account.meter.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(account);
}, "utilities");

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const existing = await prisma.utilityAccount.findUnique({
    where: { id },
    include: { meter: { select: { buildingId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, existing.meter.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { accountNumber, assignedPartyType, assignedPartyName, tenantId, startDate, endDate, status, closedWithBalance, notes } = await parseBody(req, utilityAccountUpdateSchema);

  const account = await prisma.utilityAccount.update({
    where: { id },
    data: {
      ...(accountNumber !== undefined && { accountNumber }),
      ...(assignedPartyType !== undefined && { assignedPartyType }),
      ...(assignedPartyName !== undefined && { assignedPartyName }),
      ...(tenantId !== undefined && { tenantId: tenantId || null }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(status !== undefined && { status }),
      ...(closedWithBalance !== undefined && { closedWithBalance }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(account);
}, "utilities");
