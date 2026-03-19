import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getTenantScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { toNumber } from "@/lib/utils/decimal";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const portfolio = url.searchParams.get("portfolio");

  const tenantScope = getTenantScope(user, buildingId);
  if (tenantScope === EMPTY_SCOPE) {
    return NextResponse.json({ summary: emptySummary(), buildings: [] });
  }

  const tenantWhere: any = { ...(tenantScope as object), isDeleted: false };
  if (portfolio) {
    tenantWhere.unit = { ...tenantWhere.unit, building: { ...tenantWhere.unit?.building, portfolio } };
  }

  const tenants = await prisma.tenant.findMany({
    where: tenantWhere,
    select: {
      id: true,
      name: true,
      balance: true,
      actualRent: true,
      arrearsCategory: true,
      arrearsDays: true,
      monthsOwed: true,
      leaseStatus: true,
      collectionScore: true,
      legalCases: { where: { isActive: true }, select: { inLegal: true }, take: 1 },
      unit: {
        select: {
          unitNumber: true,
          buildingId: true,
          building: {
            select: {
              id: true,
              address: true,
              portfolio: true,
              region: true,
            },
          },
        },
      },
    },
  });

  // Group by building
  const buildingMap = new Map<string, {
    id: string;
    address: string;
    portfolio: string | null;
    region: string | null;
    tenants: typeof tenants;
  }>();

  for (const t of tenants) {
    const b = t.unit.building;
    if (!buildingMap.has(b.id)) {
      buildingMap.set(b.id, { id: b.id, address: b.address, portfolio: b.portfolio, region: b.region, tenants: [] });
    }
    buildingMap.get(b.id)!.tenants.push(t);
  }

  // Build per-building aging rows
  const buildings = Array.from(buildingMap.values()).map((b) => {
    const aging = computeAging(b.tenants);
    return {
      id: b.id,
      address: b.address,
      portfolio: b.portfolio,
      region: b.region,
      tenantCount: b.tenants.length,
      ...aging,
    };
  });

  buildings.sort((a, b) => b.totalBalance - a.totalBalance);

  // Portfolio summary
  const summary = computeAging(tenants);
  const totalRent = tenants.reduce((s, t) => s + toNumber(t.actualRent), 0);
  const inLegalCount = tenants.filter((t) => t.legalCases[0]?.inLegal === true).length;

  return NextResponse.json({
    summary: {
      ...summary,
      totalRent,
      tenantCount: tenants.length,
      buildingCount: buildings.length,
      inLegalCount,
    },
    buildings,
  });
}, "collections");

function computeAging(tenants: { balance: any; arrearsCategory: string }[]) {
  let current = 0;
  let days30 = 0;
  let days60 = 0;
  let days90 = 0;
  let days120Plus = 0;
  let totalBalance = 0;
  let currentCount = 0;
  let days30Count = 0;
  let days60Count = 0;
  let days90Count = 0;
  let days120PlusCount = 0;

  for (const t of tenants) {
    const bal = toNumber(t.balance);
    totalBalance += bal;

    switch (t.arrearsCategory) {
      case "current":
        current += bal;
        if (bal > 0) currentCount++;
        break;
      case "30":
        days30 += bal;
        days30Count++;
        break;
      case "60":
        days60 += bal;
        days60Count++;
        break;
      case "90":
        days90 += bal;
        days90Count++;
        break;
      case "120+":
        days120Plus += bal;
        days120PlusCount++;
        break;
    }
  }

  return {
    current, days30, days60, days90, days120Plus, totalBalance,
    currentCount, days30Count, days60Count, days90Count, days120PlusCount,
  };
}

function emptySummary() {
  return {
    current: 0, days30: 0, days60: 0, days90: 0, days120Plus: 0, totalBalance: 0,
    currentCount: 0, days30Count: 0, days60Count: 0, days90Count: 0, days120PlusCount: 0,
    totalRent: 0, tenantCount: 0, buildingCount: 0, inLegalCount: 0,
  };
}
