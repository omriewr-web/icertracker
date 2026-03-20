/**
 * Cross-module Attention Score Engine
 *
 * Computes a 0-100 attention score for any entity by aggregating signals
 * from: arrears, signals, legal status, vacancy, work orders, utilities,
 * lease expiry, comms staleness, and collection stage.
 *
 * Higher = needs more attention now.
 */

import { prisma } from "@/lib/prisma";

export interface AttentionScore {
  entityType: string;
  entityId: string;
  score: number;
  label: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "OK";
  breakdown: AttentionBreakdown;
  topReason: string;
}

export interface AttentionBreakdown {
  arrears: number;        // 0-20: balance severity
  signals: number;        // 0-20: active operational signals
  legal: number;          // 0-15: legal case status
  vacancy: number;        // 0-10: vacancy duration
  workOrders: number;     // 0-10: overdue/urgent WOs
  utilities: number;      // 0-5:  utility risk flags
  leaseRisk: number;      // 0-10: lease expiry urgency
  staleness: number;      // 0-10: days since any action/note
}

function scoreLabel(score: number): AttentionScore["label"] {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  if (score >= 20) return "LOW";
  return "OK";
}

function topReasonFromBreakdown(b: AttentionBreakdown): string {
  const items: [string, number][] = [
    ["High arrears balance", b.arrears],
    ["Active operational signals", b.signals],
    ["Legal case requires attention", b.legal],
    ["Vacant unit aging", b.vacancy],
    ["Overdue work orders", b.workOrders],
    ["Utility account issues", b.utilities],
    ["Lease expiring soon", b.leaseRisk],
    ["No recent follow-up activity", b.staleness],
  ];
  items.sort((a, b) => b[1] - a[1]);
  return items[0][1] > 0 ? items[0][0] : "No issues detected";
}

// ── Tenant attention score ────────────────────────────────────

export async function computeTenantAttention(
  tenantId: string,
  orgId: string
): Promise<AttentionScore> {
  // Consolidated: 6 queries → 2 (single tenant include + signal count)
  const [tenant, signals] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        balance: true,
        marketRent: true,
        arrearsDays: true,
        leaseExpiration: true,
        collectionScore: true,
        unit: {
          select: {
            isVacant: true,
            vacantSince: true,
            buildingId: true,
            workOrders: {
              where: {
                status: { in: ["OPEN", "IN_PROGRESS", "PENDING_REVIEW"] },
              },
              select: { priority: true, dueDate: true },
            },
          },
        },
        legalCases: {
          where: { isActive: true },
          select: { stage: true, courtDate: true },
          take: 1,
        },
        collectionStage: {
          select: {
            stage: true,
            actionOverdue: true,
            daysPastDue: true,
            lastActionAt: true,
          },
        },
        collectionNotes: {
          orderBy: { createdAt: "desc" as const },
          select: { createdAt: true },
          take: 1,
        },
        workOrders: {
          where: {
            status: { in: ["OPEN", "IN_PROGRESS", "PENDING_REVIEW"] },
          },
          select: { priority: true, dueDate: true },
          take: 10,
        },
      },
    }),
    prisma.operationalSignal.count({
      where: {
        tenantId,
        organizationId: orgId,
        status: "active",
      },
    }),
  ]);

  const legalCase = tenant?.legalCases?.[0] ?? null;
  const collectionStage = tenant?.collectionStage ?? null;
  const lastNote = tenant?.collectionNotes?.[0] ?? null;
  const recentWOs = tenant?.workOrders ?? [];

  if (!tenant) {
    return {
      entityType: "tenant",
      entityId: tenantId,
      score: 0,
      label: "OK",
      breakdown: { arrears: 0, signals: 0, legal: 0, vacancy: 0, workOrders: 0, utilities: 0, leaseRisk: 0, staleness: 0 },
      topReason: "Tenant not found",
    };
  }

  const b: AttentionBreakdown = {
    arrears: 0,
    signals: 0,
    legal: 0,
    vacancy: 0,
    workOrders: 0,
    utilities: 0,
    leaseRisk: 0,
    staleness: 0,
  };

  // Arrears (0-20)
  const balance = Number(tenant.balance);
  const rent = Number(tenant.marketRent) || 1;
  const monthsOwed = balance / rent;
  if (monthsOwed >= 4) b.arrears = 20;
  else if (monthsOwed >= 3) b.arrears = 16;
  else if (monthsOwed >= 2) b.arrears = 12;
  else if (monthsOwed >= 1) b.arrears = 8;
  else if (balance > 0) b.arrears = 4;

  // Active signals (0-20)
  b.signals = Math.min(20, signals * 5);

  // Legal (0-15)
  if (legalCase) {
    const criticalStages = ["WARRANT", "EVICTION", "JUDGMENT"];
    const highStages = ["COURT_DATE", "STIPULATION"];
    if (criticalStages.includes(legalCase.stage)) b.legal = 15;
    else if (highStages.includes(legalCase.stage)) b.legal = 10;
    else b.legal = 5;
    // Court date within 7 days
    if (legalCase.courtDate) {
      const daysToCourtDate = Math.floor(
        (new Date(legalCase.courtDate).getTime() - Date.now()) / 86400000
      );
      if (daysToCourtDate >= 0 && daysToCourtDate <= 7) b.legal = 15;
    }
  }

  // Vacancy (0-10)
  if (tenant.unit.isVacant && tenant.unit.vacantSince) {
    const vacantDays = Math.floor(
      (Date.now() - new Date(tenant.unit.vacantSince).getTime()) / 86400000
    );
    if (vacantDays >= 90) b.vacancy = 10;
    else if (vacantDays >= 60) b.vacancy = 8;
    else if (vacantDays >= 30) b.vacancy = 5;
    else b.vacancy = 2;
  }

  // Work orders (0-10)
  const allWOs = [...recentWOs, ...tenant.unit.workOrders];
  const now = new Date();
  let woScore = 0;
  for (const wo of allWOs) {
    if (wo.priority === "URGENT") woScore += 4;
    else if (wo.priority === "HIGH") woScore += 2;
    else woScore += 1;
    if (wo.dueDate && new Date(wo.dueDate) < now) woScore += 2;
  }
  b.workOrders = Math.min(10, woScore);

  // Lease risk (0-10)
  if (tenant.leaseExpiration) {
    const daysToExpiry = Math.floor(
      (new Date(tenant.leaseExpiration).getTime() - Date.now()) / 86400000
    );
    if (daysToExpiry < 0) b.leaseRisk = 10; // expired
    else if (daysToExpiry <= 30) b.leaseRisk = 8;
    else if (daysToExpiry <= 60) b.leaseRisk = 5;
    else if (daysToExpiry <= 90) b.leaseRisk = 2;
  }

  // Staleness (0-10)
  const lastActivity = collectionStage?.lastActionAt ?? lastNote?.createdAt;
  if (lastActivity) {
    const daysSince = Math.floor(
      (Date.now() - new Date(lastActivity).getTime()) / 86400000
    );
    if (daysSince >= 30) b.staleness = 10;
    else if (daysSince >= 14) b.staleness = 6;
    else if (daysSince >= 7) b.staleness = 3;
  } else if (balance > 0) {
    b.staleness = 10; // has balance but no activity ever
  }

  const score = Math.min(
    100,
    b.arrears + b.signals + b.legal + b.vacancy + b.workOrders + b.utilities + b.leaseRisk + b.staleness
  );

  return {
    entityType: "tenant",
    entityId: tenantId,
    score,
    label: scoreLabel(score),
    breakdown: b,
    topReason: topReasonFromBreakdown(b),
  };
}

// ── Building attention score ──────────────────────────────────

export async function computeBuildingAttention(
  buildingId: string,
  orgId: string
): Promise<AttentionScore> {
  const [building, signals, tenants, activeVacancies, openWOs] =
    await Promise.all([
      prisma.building.findUnique({
        where: { id: buildingId },
        select: {
          totalUnits: true,
          riskScore: true,
          riskCategory: true,
        },
      }),
      prisma.operationalSignal.count({
        where: { buildingId, organizationId: orgId, status: "active" },
      }),
      prisma.tenant.findMany({
        where: {
          unit: { buildingId },
          isDeleted: false,
          balance: { gt: 0 },
        },
        select: { balance: true, arrearsDays: true },
      }),
      prisma.unit.count({
        where: { buildingId, isVacant: true },
      }),
      prisma.workOrder.findMany({
        where: {
          buildingId,
          status: { in: ["OPEN", "IN_PROGRESS", "PENDING_REVIEW"] },
        },
        select: { priority: true, dueDate: true },
      }),
    ]);

  if (!building) {
    return {
      entityType: "building",
      entityId: buildingId,
      score: 0,
      label: "OK",
      breakdown: { arrears: 0, signals: 0, legal: 0, vacancy: 0, workOrders: 0, utilities: 0, leaseRisk: 0, staleness: 0 },
      topReason: "Building not found",
    };
  }

  const b: AttentionBreakdown = {
    arrears: 0,
    signals: 0,
    legal: 0,
    vacancy: 0,
    workOrders: 0,
    utilities: 0,
    leaseRisk: 0,
    staleness: 0,
  };

  // Arrears: aggregate across tenants (0-20)
  const totalArrears = tenants.reduce((s, t) => s + Number(t.balance), 0);
  const avgDays = tenants.length > 0
    ? tenants.reduce((s, t) => s + t.arrearsDays, 0) / tenants.length
    : 0;
  if (totalArrears >= 50000) b.arrears = 20;
  else if (totalArrears >= 20000) b.arrears = 15;
  else if (totalArrears >= 10000) b.arrears = 10;
  else if (totalArrears > 0) b.arrears = 5;

  // Signals (0-20)
  b.signals = Math.min(20, signals * 3);

  // Vacancy (0-10)
  const totalUnits = building.totalUnits || 1;
  const vacancyRate = activeVacancies / totalUnits;
  if (vacancyRate >= 0.2) b.vacancy = 10;
  else if (vacancyRate >= 0.1) b.vacancy = 7;
  else if (activeVacancies > 0) b.vacancy = 3;

  // Work orders (0-10)
  const now = new Date();
  let woScore = 0;
  for (const wo of openWOs) {
    if (wo.priority === "URGENT") woScore += 3;
    else if (wo.priority === "HIGH") woScore += 2;
    else woScore += 1;
    if (wo.dueDate && new Date(wo.dueDate) < now) woScore += 2;
  }
  b.workOrders = Math.min(10, woScore);

  // Use existing risk score for remaining dimensions
  if (building.riskScore) {
    const risk = building.riskScore;
    b.legal = Math.min(15, Math.round(risk * 0.15));
  }

  const score = Math.min(
    100,
    b.arrears + b.signals + b.legal + b.vacancy + b.workOrders + b.utilities + b.leaseRisk + b.staleness
  );

  return {
    entityType: "building",
    entityId: buildingId,
    score,
    label: scoreLabel(score),
    breakdown: b,
    topReason: topReasonFromBreakdown(b),
  };
}

// ── Batch: rank tenants by attention ──────────────────────────

export async function rankTenantsByAttention(
  orgId: string,
  buildingId?: string,
  limit = 20
): Promise<AttentionScore[]> {
  // Fetch tenants with balance > 0 or active signals
  const where: Record<string, unknown> = {
    isDeleted: false,
    unit: { building: { organizationId: orgId } },
  };
  if (buildingId) {
    (where.unit as Record<string, unknown>).buildingId = buildingId;
  }

  const tenants = await prisma.tenant.findMany({
    where: { ...where, balance: { gt: 0 } },
    select: { id: true },
    orderBy: { balance: "desc" },
    take: 100,
  });

  const scores = await Promise.all(
    tenants.map((t) => computeTenantAttention(t.id, orgId))
  );

  return scores.sort((a, b) => b.score - a.score).slice(0, limit);
}
