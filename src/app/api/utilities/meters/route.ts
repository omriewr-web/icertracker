import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getBuildingScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { computeRiskFlags, primaryRiskFlag } from "@/lib/utility-risk";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const utilityType = url.searchParams.get("utilityType");
  const riskFilter = url.searchParams.get("risk");
  const partyFilter = url.searchParams.get("party");

  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const where: any = { ...scope };
  if (utilityType) where.utilityType = utilityType;

  const meters = await prisma.utilityMeter.findMany({
    where,
    include: {
      building: { select: { id: true, address: true } },
      unit: {
        select: {
          id: true, unitNumber: true, isVacant: true,
          tenant: { select: { id: true, name: true } },
        },
      },
      accounts: {
        select: {
          id: true, accountNumber: true, assignedPartyType: true,
          assignedPartyName: true, status: true, closedWithBalance: true,
          tenantId: true, startDate: true, endDate: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ building: { address: "asc" } }, { unit: { unitNumber: "asc" } }],
  });

  const result = meters.map((m) => {
    const flags = computeRiskFlags(m);
    const primary = primaryRiskFlag(flags);
    const activeAccount = m.accounts.find((a) => a.status === "active");

    return {
      id: m.id,
      buildingId: m.buildingId,
      buildingAddress: m.building.address,
      unitId: m.unitId,
      unitNumber: m.unit?.unitNumber || null,
      isVacant: m.unit?.isVacant ?? null,
      tenantName: m.unit?.tenant?.name || null,
      utilityType: m.utilityType,
      providerName: m.providerName,
      meterNumber: m.meterNumber,
      serviceAddress: m.serviceAddress,
      isActive: m.isActive,
      notes: m.notes,
      accountNumber: activeAccount?.accountNumber || null,
      assignedPartyType: activeAccount?.assignedPartyType || null,
      assignedPartyName: activeAccount?.assignedPartyName || null,
      accountStatus: activeAccount?.status || null,
      accountCount: m.accounts.length,
      riskFlags: flags,
      riskFlag: primary,
    };
  });

  // Apply client-side filters
  let filtered = result;
  if (riskFilter) {
    filtered = filtered.filter((m) => m.riskFlag === riskFilter);
  }
  if (partyFilter) {
    filtered = filtered.filter((m) => m.assignedPartyType === partyFilter);
  }

  return NextResponse.json(filtered);
}, "maintenance");

export const POST = withAuth(async (req, { user }) => {
  const body = await req.json();
  const { buildingId, unitId, utilityType, providerName, meterNumber, serviceAddress, notes } = body;

  if (!buildingId || !utilityType) {
    return NextResponse.json({ error: "buildingId and utilityType are required" }, { status: 400 });
  }

  const meter = await prisma.utilityMeter.create({
    data: {
      buildingId,
      unitId: unitId || null,
      utilityType,
      providerName: providerName || null,
      meterNumber: meterNumber || null,
      serviceAddress: serviceAddress || null,
      notes: notes || null,
    },
  });

  return NextResponse.json(meter, { status: 201 });
}, "maintenance");
