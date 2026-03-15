import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { getBuildingScope, EMPTY_SCOPE, assertBuildingAccess } from "@/lib/data-scope";
import { unitCreateSchema } from "@/lib/validations";
import { getDisplayAddress } from "@/lib/building-matching";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");

  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const where: any = { ...scope };

  const units = await prisma.unit.findMany({
    where,
    include: {
      building: { select: { id: true, address: true, altAddress: true } },
      tenant: { select: { id: true, name: true, marketRent: true, balance: true, leaseStatus: true } },
    },
    orderBy: [{ building: { address: "asc" } }, { unitNumber: "asc" }],
  });

  return NextResponse.json(
    units.map((u) => ({
      id: u.id,
      unitNumber: u.unitNumber,
      unitType: u.unitType,
      askingRent: u.askingRent ? Number(u.askingRent) : null,
      isVacant: u.isVacant,
      buildingId: u.building.id,
      buildingAddress: getDisplayAddress(u.building),
      tenantId: u.tenant?.id ?? null,
      tenantName: u.tenant?.name ?? null,
      marketRent: u.tenant ? Number(u.tenant.marketRent) : null,
      balance: u.tenant ? Number(u.tenant.balance) : null,
    }))
  );
}, "dash");

export const POST = withAuth(async (req, { user }) => {
  const { buildingId, unitNumber, unitType } = await parseBody(req, unitCreateSchema);

  // Verify building access
  const accessErr = await assertBuildingAccess(user, buildingId);
  if (accessErr) return accessErr;

  const existing = await prisma.unit.findUnique({
    where: { buildingId_unitNumber: { buildingId, unitNumber } },
  });
  if (existing) {
    return NextResponse.json({ error: "Unit already exists in this building" }, { status: 400 });
  }

  const unit = await prisma.unit.create({
    data: { buildingId, unitNumber, unitType: unitType || null, isVacant: true },
  });
  return NextResponse.json(unit, { status: 201 });
}, "edit");
