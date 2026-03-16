import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getTenantScope, getBuildingScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { PortfolioMetrics } from "@/types";
import { toNumber } from "@/lib/utils/decimal";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const portfolio = url.searchParams.get("portfolio");

  const tenantScope = getTenantScope(user, buildingId);
  if (tenantScope === EMPTY_SCOPE) {
    const empty: PortfolioMetrics = {
      totalUnits: 0, occupied: 0, vacant: 0, totalMarketRent: 0, totalBalance: 0,
      occupancyRate: 0, lostRent: 0, arrears30: 0, arrears60: 0, arrears90Plus: 0,
      arrears30$: 0, arrears60$: 0, arrears90Plus$: 0, current$: 0,
      legalCaseCount: 0, noLease: 0, expiredLease: 0, expiringSoon: 0,
    };
    return NextResponse.json(empty);
  }

  const where: any = { ...(tenantScope as object) };

  // Apply portfolio filter
  if (portfolio) {
    where.unit = { ...where.unit, building: { ...where.unit?.building, portfolio } };
  }

  const tenants = await prisma.tenant.findMany({
    where,
    select: {
      marketRent: true,
      balance: true,
      arrearsCategory: true,
      leaseStatus: true,
      unit: { select: { isVacant: true, isResidential: true } },
    },
  });

  // Unit count — use centralized scope helper (EMPTY_SCOPE already handled above)
  const unitScope = getBuildingScope(user, buildingId);
  const unitWhere: any = unitScope === EMPTY_SCOPE ? { buildingId: "__none__" } : { ...unitScope };
  if (portfolio) {
    unitWhere.building = { ...unitWhere.building, portfolio };
  }

  const [totalUnitCount, vacantUnitCount] = await Promise.all([
    prisma.unit.count({ where: { ...unitWhere, isResidential: true } }),
    prisma.unit.count({ where: { ...unitWhere, isResidential: true, isVacant: true } }),
  ]);
  const units = totalUnitCount;
  const occupied = totalUnitCount - vacantUnitCount;
  const vacant = vacantUnitCount;

  const legalWhere: any = { isActive: true, inLegal: true };
  if (Object.keys(tenantScope as object).length > 0) {
    legalWhere.tenant = tenantScope;
  }
  const legalCaseCount = await prisma.legalCase.count({ where: legalWhere });
  const totalMarketRent = tenants.reduce((s, t) => s + toNumber(t.marketRent), 0);
  const totalBalance = tenants.reduce((s, t) => s + toNumber(t.balance), 0);
  const lostRent = tenants
    .filter((t) => t.unit.isVacant && t.unit.isResidential)
    .reduce((s, t) => s + toNumber(t.marketRent), 0);

  const metrics: PortfolioMetrics = {
    totalUnits: units,
    occupied,
    vacant,
    totalMarketRent,
    totalBalance,
    occupancyRate: units > 0 ? (occupied / units) * 100 : 0,
    lostRent,
    arrears30: tenants.filter((t) => t.arrearsCategory === "30").length,
    arrears60: tenants.filter((t) => t.arrearsCategory === "60").length,
    arrears90Plus: tenants.filter((t) => ["90", "120+"].includes(t.arrearsCategory)).length,
    arrears30$: tenants.filter((t) => t.arrearsCategory === "30").reduce((s, t) => s + toNumber(t.balance), 0),
    arrears60$: tenants.filter((t) => t.arrearsCategory === "60").reduce((s, t) => s + toNumber(t.balance), 0),
    arrears90Plus$: tenants.filter((t) => ["90", "120+"].includes(t.arrearsCategory)).reduce((s, t) => s + toNumber(t.balance), 0),
    current$: tenants.filter((t) => !t.arrearsCategory || t.arrearsCategory === "current").reduce((s, t) => s + toNumber(t.balance), 0),
    legalCaseCount,
    noLease: tenants.filter((t) => t.leaseStatus === "no-lease").length,
    expiredLease: tenants.filter((t) => t.leaseStatus === "expired").length,
    expiringSoon: tenants.filter((t) => t.leaseStatus === "expiring-soon").length,
  };

  return NextResponse.json(metrics);
}, "dash");
