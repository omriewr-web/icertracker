import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getBuildingScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { computeRiskFlags } from "@/lib/utility-risk";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");

  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) {
    return NextResponse.json({
      totalMeters: 0, assigned: 0, unassigned: 0,
      vacantTenantAccount: 0, occupiedOwnerPaid: 0, missingAccountNumber: 0,
      closedWithBalance: 0, missingMeterNumber: 0,
    });
  }

  const meters = await prisma.utilityMeter.findMany({
    where: { ...scope, isActive: true },
    include: {
      unit: {
        select: {
          isVacant: true,
          tenant: { select: { id: true } },
        },
      },
      accounts: {
        select: {
          status: true, accountNumber: true, assignedPartyType: true,
          closedWithBalance: true,
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

  for (const m of meters) {
    const flags = computeRiskFlags(m);
    const hasActiveAccount = m.accounts.some((a) => a.status === "active");
    if (hasActiveAccount) assigned++;
    else unassigned++;
    if (flags.includes("vacant_tenant_account")) vacantTenantAccount++;
    if (flags.includes("occupied_owner_paid")) occupiedOwnerPaid++;
    if (flags.includes("missing_account_number")) missingAccountNumber++;
    if (flags.includes("closed_with_balance")) closedWithBalance++;
    if (flags.includes("missing_meter_number")) missingMeterNumber++;
  }

  return NextResponse.json({
    totalMeters: meters.length,
    assigned,
    unassigned,
    vacantTenantAccount,
    occupiedOwnerPaid,
    missingAccountNumber,
    closedWithBalance,
    missingMeterNumber,
  });
}, "maintenance");
