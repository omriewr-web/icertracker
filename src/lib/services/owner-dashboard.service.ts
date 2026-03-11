import { prisma } from "@/lib/prisma";
import { getBuildingScope, getBuildingIdScope, getTenantScope, EMPTY_SCOPE } from "@/lib/data-scope";
import type { OwnerDashboardDTO } from "@/types";

interface ScopeUser {
  role: string;
  assignedProperties?: string[] | null;
}

export async function getOwnerDashboard(user: ScopeUser): Promise<OwnerDashboardDTO> {
  const buildingScope = getBuildingScope(user);
  const buildingIdScope = getBuildingIdScope(user);
  const tenantScope = getTenantScope(user);

  if (buildingScope === EMPTY_SCOPE || buildingIdScope === EMPTY_SCOPE || tenantScope === EMPTY_SCOPE) {
    return emptyDashboard();
  }

  // ── Parallel data fetching ──────────────────────────────────
  const [
    units,
    tenants,
    vacancies,
    violations,
    legalCases,
    buildings,
    priorSnapshots,
  ] = await Promise.all([
    // All residential units
    prisma.unit.findMany({
      where: { ...buildingScope as object, isResidential: true },
      select: { id: true, isVacant: true, buildingId: true },
    }),

    // All tenants with financial data (no notes, no internal data)
    prisma.tenant.findMany({
      where: tenantScope as object,
      select: {
        id: true,
        balance: true,
        marketRent: true,
        actualRent: true,
        arrearsCategory: true,
        unit: { select: { buildingId: true, isVacant: true, isResidential: true } },
      },
    }),

    // Active vacancies
    prisma.vacancy.findMany({
      where: { ...(buildingScope as object), isActive: true },
      select: {
        id: true,
        createdAt: true,
        askingRent: true,
        unit: {
          select: {
            unitNumber: true,
            building: { select: { address: true } },
          },
        },
      },
    }),

    // Open violations
    prisma.violation.findMany({
      where: { ...(buildingScope as object), isOpen: true },
      select: {
        id: true,
        class: true,
        respondByDate: true,
        buildingId: true,
        building: { select: { address: true } },
      },
    }),

    // Active legal cases (no notes or internal data)
    prisma.legalCase.findMany({
      where: {
        isActive: true,
        inLegal: true,
        tenant: tenantScope as object,
      },
      select: {
        id: true,
        stage: true,
        arrearsBalance: true,
      },
    }),

    // Buildings for per-building table
    prisma.building.findMany({
      where: buildingIdScope as object,
      select: {
        id: true,
        address: true,
        totalUnits: true,
        units: {
          where: { isResidential: true },
          select: { id: true, isVacant: true },
        },
        _count: {
          select: {
            violations: { where: { isOpen: true } },
            legalCases: { where: { inLegal: true } },
          },
        },
      },
    }),

    // Prior month AR snapshots for trend
    getPriorMonthArrears(user),
  ]);

  const now = new Date();

  // ── Portfolio summary ───────────────────────────────────────
  const totalUnits = units.length;
  const vacantUnits = units.filter((u) => u.isVacant).length;
  const occupiedUnits = totalUnits - vacantUnits;
  const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

  const totalMonthlyRent = tenants
    .filter((t) => !t.unit.isVacant && t.unit.isResidential)
    .reduce((s, t) => s + Number(t.actualRent || t.marketRent), 0);

  const totalArrears = tenants.reduce((s, t) => s + Math.max(0, Number(t.balance)), 0);

  // Trend: compare to prior month
  let arrearsTrend: "improving" | "worsening" | "flat" | null = null;
  if (priorSnapshots !== null) {
    const diff = totalArrears - priorSnapshots;
    if (Math.abs(diff) < totalArrears * 0.02) arrearsTrend = "flat";
    else if (diff < 0) arrearsTrend = "improving";
    else arrearsTrend = "worsening";
  }

  // ── Arrears buckets ─────────────────────────────────────────
  const buckets = { current: { count: 0, amount: 0 }, d30: { count: 0, amount: 0 }, d60: { count: 0, amount: 0 }, d90: { count: 0, amount: 0 }, d120plus: { count: 0, amount: 0 } };
  for (const t of tenants) {
    const bal = Math.max(0, Number(t.balance));
    const cat = t.arrearsCategory;
    if (cat === "30") { buckets.d30.count++; buckets.d30.amount += bal; }
    else if (cat === "60") { buckets.d60.count++; buckets.d60.amount += bal; }
    else if (cat === "90") { buckets.d90.count++; buckets.d90.amount += bal; }
    else if (cat === "120+") { buckets.d120plus.count++; buckets.d120plus.amount += bal; }
    else if (cat === "current" || !cat) { buckets.current.count++; buckets.current.amount += bal; }
  }

  // ── Vacancies ───────────────────────────────────────────────
  const vacancyUnits = vacancies.map((v) => {
    const daysVacant = Math.ceil((now.getTime() - v.createdAt.getTime()) / 86400000);
    const rent = Number(v.askingRent || 0);
    return {
      buildingAddress: v.unit.building.address,
      unitNumber: v.unit.unitNumber,
      daysVacant,
      estimatedLostRent: rent,
    };
  }).sort((a, b) => b.daysVacant - a.daysVacant);

  const estimatedLostRent = vacancyUnits.reduce((s, v) => s + v.estimatedLostRent, 0);

  // ── Violations ──────────────────────────────────────────────
  let classA = 0, classB = 0, classC = 0, pastCureDate = 0;
  const violationsByBuilding = new Map<string, { address: string; count: number }>();

  for (const v of violations) {
    if (v.class === "A") classA++;
    else if (v.class === "B") classB++;
    else if (v.class === "C") classC++;

    if (v.respondByDate && v.respondByDate < now) pastCureDate++;

    const existing = violationsByBuilding.get(v.buildingId);
    if (existing) existing.count++;
    else violationsByBuilding.set(v.buildingId, { address: v.building.address, count: 1 });
  }

  const topBuildings = [...violationsByBuilding.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Legal ───────────────────────────────────────────────────
  const legalBalance = legalCases.reduce((s, c) => s + Number(c.arrearsBalance || 0), 0);
  const byStage: Record<string, number> = {};
  for (const c of legalCases) {
    const stage = c.stage || "unknown";
    byStage[stage] = (byStage[stage] || 0) + 1;
  }

  // ── Per-building table ──────────────────────────────────────
  const buildingRows = buildings.map((b) => {
    const resUnits = b.units.length;
    const vacCount = b.units.filter((u) => u.isVacant).length;
    const occRate = resUnits > 0 ? ((resUnits - vacCount) / resUnits) * 100 : 0;

    // Sum arrears for this building from tenants data
    const buildingArrears = tenants
      .filter((t) => t.unit.buildingId === b.id)
      .reduce((s, t) => s + Math.max(0, Number(t.balance)), 0);

    return {
      id: b.id,
      address: b.address,
      totalUnits: resUnits,
      occupancyRate: Math.round(occRate * 10) / 10,
      arrears: Math.round(buildingArrears * 100) / 100,
      openViolations: b._count.violations,
      activeLegalCases: b._count.legalCases,
    };
  }).sort((a, b) => b.arrears - a.arrears);

  return {
    generatedAt: now.toISOString(),
    portfolio: {
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate: Math.round(occupancyRate * 10) / 10,
      totalMonthlyRent: Math.round(totalMonthlyRent * 100) / 100,
      totalArrears: Math.round(totalArrears * 100) / 100,
      collectionRate: null, // No billed/collected month logic exists yet
      arrearsTrend,
      priorMonthArrears: priorSnapshots !== null ? Math.round(priorSnapshots * 100) / 100 : null,
    },
    arrears: buckets,
    vacancies: {
      count: vacancies.length,
      rate: totalUnits > 0 ? Math.round((vacantUnits / totalUnits) * 1000) / 10 : 0,
      estimatedLostRent: Math.round(estimatedLostRent * 100) / 100,
      units: vacancyUnits,
    },
    violations: {
      totalOpen: violations.length,
      classA,
      classB,
      classC,
      pastCureDate,
      topBuildings,
    },
    legal: {
      totalActive: legalCases.length,
      totalBalance: Math.round(legalBalance * 100) / 100,
      byStage,
    },
    buildings: buildingRows,
  };
}

// ── Prior month arrears from ARSnapshot ──────────────────────

async function getPriorMonthArrears(user: ScopeUser): Promise<number | null> {
  const buildingScope = getBuildingScope(user);
  if (buildingScope === EMPTY_SCOPE) return null;

  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const snapshots = await prisma.aRSnapshot.findMany({
    where: {
      ...(buildingScope as object),
      month: { gte: firstOfLastMonth, lt: firstOfThisMonth },
    },
    select: { totalBalance: true },
  });

  if (snapshots.length === 0) return null;
  return snapshots.reduce((s, snap) => s + Number(snap.totalBalance), 0);
}

// ── Empty dashboard ──────────────────────────────────────────

function emptyDashboard(): OwnerDashboardDTO {
  return {
    generatedAt: new Date().toISOString(),
    portfolio: {
      totalUnits: 0, occupiedUnits: 0, vacantUnits: 0, occupancyRate: 0,
      totalMonthlyRent: 0, totalArrears: 0, collectionRate: null,
      arrearsTrend: null, priorMonthArrears: null,
    },
    arrears: {
      current: { count: 0, amount: 0 }, d30: { count: 0, amount: 0 },
      d60: { count: 0, amount: 0 }, d90: { count: 0, amount: 0 },
      d120plus: { count: 0, amount: 0 },
    },
    vacancies: { count: 0, rate: 0, estimatedLostRent: 0, units: [] },
    violations: { totalOpen: 0, classA: 0, classB: 0, classC: 0, pastCureDate: 0, topBuildings: [] },
    legal: { totalActive: 0, totalBalance: 0, byStage: {} },
    buildings: [],
  };
}
