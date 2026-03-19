import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getBuildingScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { computeRiskFlags } from "@/lib/utility-risk";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");

  const scope = getBuildingScope(user, buildingId);
  const emptyResponse = {
    totalMeters: 0, assigned: 0, unassigned: 0,
    vacantTenantAccount: 0, occupiedOwnerPaid: 0, missingAccountNumber: 0,
    closedWithBalance: 0, missingMeterNumber: 0,
    totalAccounts: 0, activeAccounts: 0,
    paidThisMonth: 0, unpaidThisMonth: 0, noCheckThisMonth: 0,
    withRiskSignals: 0,
    transferNeeded: 0, movedOutActive: 0, leaseExpiredActive: 0, vacantOwnerResponsibility: 0,
    buildingRollup: [],
  };
  if (scope === EMPTY_SCOPE) return NextResponse.json(emptyResponse);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // No take limit: full dataset needed for aggregation summary counts
  const meters = await prisma.utilityMeter.findMany({
    where: { ...scope, isActive: true },
    include: {
      building: { select: { id: true, address: true } },
      unit: {
        select: {
          isVacant: true,
          tenant: { select: { id: true, leaseExpiration: true, moveOutDate: true } },
        },
      },
      accounts: {
        select: {
          id: true, status: true, accountNumber: true, assignedPartyType: true,
          closedWithBalance: true,
          monthlyChecks: {
            where: { month: currentMonth, year: currentYear },
            select: { paymentStatus: true },
          },
        },
      },
    },
  });

  let assigned = 0;
  let unassigned = 0;
  let vacantTenantAccount = 0;
  let occupiedOwnerPaid = 0;
  let missingAccountNumber = 0;
  let closedWithBalance = 0;
  let missingMeterNumber = 0;
  let totalAccounts = 0;
  let activeAccounts = 0;
  let paidThisMonth = 0;
  let unpaidThisMonth = 0;
  let noCheckThisMonth = 0;
  let withRiskSignals = 0;
  let transferNeeded = 0;
  let movedOutActive = 0;
  let leaseExpiredActive = 0;
  let vacantOwnerResponsibility = 0;

  const buildingMap = new Map<string, { id: string; address: string; totalAccounts: number; unpaidThisMonth: number; noCheckThisMonth: number; riskCount: number; transferNeeded: number }>();

  for (const m of meters) {
    const meterForRisk = { ...m, utilityType: m.utilityType, unitId: m.unitId, classification: (m as any).classification };
    const flags = computeRiskFlags(meterForRisk);
    const hasActiveAccount = m.accounts.some((a) => a.status === "active");
    if (hasActiveAccount) assigned++;
    else unassigned++;
    if (flags.includes("vacant_tenant_account")) vacantTenantAccount++;
    if (flags.includes("occupied_owner_paid")) occupiedOwnerPaid++;
    if (flags.includes("missing_account_number")) missingAccountNumber++;
    if (flags.includes("closed_with_balance")) closedWithBalance++;
    if (flags.includes("missing_meter_number")) missingMeterNumber++;

    const hasRisk = flags.some((f) => f !== "ok");
    if (hasRisk) withRiskSignals++;

    // Transfer-related counts
    if (flags.includes("transfer_needed")) transferNeeded++;
    const activeAccs = m.accounts.filter((a) => a.status === "active");
    for (const acc of activeAccs) {
      if (acc.assignedPartyType === "tenant" && m.unit?.tenant) {
        const moveOut = m.unit.tenant.moveOutDate ? new Date(m.unit.tenant.moveOutDate) : null;
        const leaseExp = m.unit.tenant.leaseExpiration ? new Date(m.unit.tenant.leaseExpiration) : null;
        if (moveOut && moveOut < now) movedOutActive++;
        else if (leaseExp && leaseExp < now) leaseExpiredActive++;
      }
    }
    if (m.unit?.isVacant) {
      const hasOwnerAccount = activeAccs.some((a) => a.assignedPartyType === "owner" || a.assignedPartyType === "management");
      if (hasOwnerAccount) vacantOwnerResponsibility++;
    }

    // Building rollup init
    if (!buildingMap.has(m.buildingId)) {
      buildingMap.set(m.buildingId, {
        id: m.buildingId,
        address: m.building.address,
        totalAccounts: 0,
        unpaidThisMonth: 0,
        noCheckThisMonth: 0,
        riskCount: 0,
        transferNeeded: 0,
      });
    }
    const bEntry = buildingMap.get(m.buildingId)!;
    if (hasRisk) bEntry.riskCount++;
    if (flags.includes("transfer_needed")) bEntry.transferNeeded++;

    for (const acc of m.accounts) {
      totalAccounts++;
      if (acc.status === "active") {
        activeAccounts++;
        const check = acc.monthlyChecks[0];
        if (check) {
          if (check.paymentStatus === "paid") paidThisMonth++;
          else unpaidThisMonth++;
        } else {
          noCheckThisMonth++;
        }

        bEntry.totalAccounts++;
        if (check && check.paymentStatus !== "paid") bEntry.unpaidThisMonth++;
        if (!check) bEntry.noCheckThisMonth++;
      }
    }
  }

  const buildingRollup = Array.from(buildingMap.values()).sort((a, b) =>
    (b.riskCount + b.unpaidThisMonth + b.noCheckThisMonth) - (a.riskCount + a.unpaidThisMonth + a.noCheckThisMonth)
  );

  return NextResponse.json({
    totalMeters: meters.length,
    assigned,
    unassigned,
    vacantTenantAccount,
    occupiedOwnerPaid,
    missingAccountNumber,
    closedWithBalance,
    missingMeterNumber,
    totalAccounts,
    activeAccounts,
    paidThisMonth,
    unpaidThisMonth,
    noCheckThisMonth,
    withRiskSignals,
    transferNeeded,
    movedOutActive,
    leaseExpiredActive,
    vacantOwnerResponsibility,
    buildingRollup,
  });
}, "utilities");
