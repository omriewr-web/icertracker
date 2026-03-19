import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getBuildingScope, EMPTY_SCOPE, assertBuildingAccess } from "@/lib/data-scope";
import { parseBody } from "@/lib/api-helpers";
import { utilityMeterCreateSchema } from "@/lib/validations";
import { computeRiskFlags, primaryRiskFlag } from "@/lib/utility-risk";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const utilityType = url.searchParams.get("utilityType");
  const riskFilter = url.searchParams.get("risk");
  const partyFilter = url.searchParams.get("party");
  const checkStatus = url.searchParams.get("checkStatus");

  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const where: any = { ...scope };
  if (utilityType) where.utilityType = utilityType;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const meters = await prisma.utilityMeter.findMany({
    where,
    include: {
      building: { select: { id: true, address: true } },
      unit: {
        select: {
          id: true, unitNumber: true, isVacant: true,
          tenant: { select: { id: true, name: true, leaseExpiration: true, moveOutDate: true, leaseStatus: true } },
        },
      },
      accounts: {
        select: {
          id: true, accountNumber: true, assignedPartyType: true,
          assignedPartyName: true, status: true, closedWithBalance: true,
          tenantId: true, startDate: true, endDate: true,
          monthlyChecks: {
            orderBy: [{ year: "desc" }, { month: "desc" }],
            take: 1,
            select: { id: true, month: true, year: true, paymentStatus: true, verifiedAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ building: { address: "asc" } }, { unit: { unitNumber: "asc" } }],
    take: 200,
  });

  const result = meters.map((m) => {
    const meterForRisk = { ...m, utilityType: m.utilityType, unitId: m.unitId, classification: (m as any).classification };
    const flags = computeRiskFlags(meterForRisk);
    const primary = primaryRiskFlag(flags);
    const activeAccount = m.accounts.find((a) => a.status === "active");

    // Current month check status
    let currentMonthCheckStatus: "paid" | "unpaid" | "not_recorded" = "not_recorded";
    let lastCheckDate: string | null = null;

    if (activeAccount) {
      const lastCheck = activeAccount.monthlyChecks[0];
      if (lastCheck) {
        lastCheckDate = lastCheck.verifiedAt?.toISOString() || `${lastCheck.year}-${String(lastCheck.month).padStart(2, "0")}-01`;
        if (lastCheck.month === currentMonth && lastCheck.year === currentYear) {
          currentMonthCheckStatus = lastCheck.paymentStatus === "paid" ? "paid" : "unpaid";
        }
      }
    }

    // Transfer needed status
    let transferNeeded = false;
    let transferReason: string | null = null;
    if (activeAccount?.assignedPartyType === "tenant" && m.unit?.tenant) {
      const tenant = m.unit.tenant;
      const leaseExp = tenant.leaseExpiration ? new Date(tenant.leaseExpiration) : null;
      const moveOut = tenant.moveOutDate ? new Date(tenant.moveOutDate) : null;
      if (moveOut && moveOut < now) {
        transferNeeded = true;
        transferReason = "moved_out";
      } else if (leaseExp && leaseExp < now) {
        transferNeeded = true;
        transferReason = "lease_expired";
      }
    }

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
      currentMonthCheckStatus,
      lastCheckDate,
      transferNeeded,
      transferReason,
    };
  });

  // Apply filters
  let filtered = result;
  if (riskFilter) {
    filtered = filtered.filter((m) => m.riskFlag === riskFilter);
  }
  if (partyFilter) {
    filtered = filtered.filter((m) => m.assignedPartyType === partyFilter);
  }
  if (checkStatus) {
    filtered = filtered.filter((m) => m.currentMonthCheckStatus === checkStatus);
  }

  return NextResponse.json(filtered);
}, "utilities");

export const POST = withAuth(async (req, { user }) => {
  const { buildingId, unitId, utilityType, classification, providerName, meterNumber, serviceAddress, notes } = await parseBody(req, utilityMeterCreateSchema);

  // Verify building access
  const accessErr = await assertBuildingAccess(user, buildingId);
  if (accessErr) return accessErr;

  const meter = await prisma.utilityMeter.create({
    data: {
      buildingId,
      unitId: unitId || null,
      utilityType,
      classification: classification || "unit_submeter",
      providerName: providerName || null,
      meterNumber: meterNumber || null,
      serviceAddress: serviceAddress || null,
      notes: notes || null,
    },
  });

  return NextResponse.json(meter, { status: 201 });
}, "utilities");
