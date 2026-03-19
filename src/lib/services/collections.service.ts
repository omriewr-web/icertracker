import { prisma } from "@/lib/prisma";
import { getTenantScope, getBuildingScope, EMPTY_SCOPE, canAccessBuilding } from "@/lib/data-scope";
import type { CollectionActionType, Prisma } from "@prisma/client";
import { COLLECTION_CASE_STATUSES } from "@/lib/constants/statuses";
import { calcCollectionScore, getLeaseStatus } from "@/lib/scoring";

// ── Helpers ───────────────────────────────────────────────────

interface ScopeUser {
  role: string;
  assignedProperties?: string[] | null;
  organizationId?: string | null;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function verifyBuildingAccess(user: ScopeUser, tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, unit: { select: { buildingId: true } } },
  });
  if (!tenant) throw new ApiError("Tenant not found", 404);
  if (!(await canAccessBuilding(user, tenant.unit.buildingId))) throw new ApiError("Forbidden", 403);
  return tenant.unit.buildingId;
}

// ── getCollectionsDashboard ───────────────────────────────────

interface DashboardResult {
  totalBalance: number;
  tenantCount: number;
  legalCount: number;
  staleCount: number;
  followUpsDue: number;
}

export async function getCollectionsDashboard(
  user: ScopeUser,
  buildingId?: string | null
): Promise<DashboardResult> {
  const scope = getTenantScope(user, buildingId);
  if (scope === EMPTY_SCOPE) {
    return { totalBalance: 0, tenantCount: 0, legalCount: 0, staleCount: 0, followUpsDue: 0 };
  }

  // All tenants with balance > 0
  const tenants = await prisma.tenant.findMany({
    where: {
      ...(scope as object),
      isDeleted: false,
      balance: { gt: 0 },
    },
    select: {
      id: true,
      balance: true,
      legalCases: { where: { isActive: true }, select: { inLegal: true }, take: 1 },
    },
  });

  const totalBalance = tenants.reduce((sum, t) => sum + Number(t.balance), 0);
  const legalCount = tenants.filter((t) => t.legalCases[0]?.inLegal === true).length;

  const tenantIds = tenants.map((t) => t.id);

  // Tenants with no TenantNote in the last 30 days = "stale"
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentlyNotedIds = tenantIds.length > 0
    ? await prisma.tenantNote.findMany({
        where: {
          tenantId: { in: tenantIds },
          createdAt: { gte: thirtyDaysAgo },
        },
        distinct: ["tenantId"],
        select: { tenantId: true },
      })
    : [];
  const notedSet = new Set(recentlyNotedIds.map((n) => n.tenantId));
  const staleCount = tenantIds.filter((id) => !notedSet.has(id)).length;

  // Follow-ups due: tenants with a CollectionNote where followUpDate <= today
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const followUpsDue = tenantIds.length > 0
    ? (await prisma.collectionNote.findMany({
        where: {
          tenantId: { in: tenantIds },
          followUpDate: { lte: today },
        },
        distinct: ["tenantId"],
        select: { tenantId: true },
      })).length
    : 0;

  return {
    totalBalance,
    tenantCount: tenants.length,
    legalCount,
    staleCount,
    followUpsDue,
  };
}

// ── getTenantCollectionProfile ────────────────────────────────

export async function getTenantCollectionProfile(
  user: ScopeUser,
  tenantId: string
) {
  const buildingId = await verifyBuildingAccess(user, tenantId);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [tenant, legalCase, latestARSnapshot, collectionCase, collectionNotes, tenantNotes, payments, balanceHistory] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        balance: true,
        actualRent: true,
        marketRent: true,
        legalRent: true,
        collectionScore: true,
        leaseStatus: true,
        leaseExpiration: true,
        arrearsCategory: true,
        arrearsDays: true,
        monthsOwed: true,
        unit: {
          select: {
            unitNumber: true,
            building: { select: { id: true, address: true, altAddress: true } },
          },
        },
      },
    }),
    prisma.legalCase.findFirst({
      where: { tenantId, inLegal: true },
    }),
    prisma.aRSnapshot.findFirst({
      where: { tenantId },
      orderBy: { snapshotDate: "desc" },
    }),
    prisma.collectionCase.findFirst({
      where: { tenantId, isActive: true },
      select: { id: true, status: true, lastActionDate: true, nextActionDate: true },
    }),
    prisma.collectionNote.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true } },
      },
    }),
    prisma.tenantNote.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        author: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.findMany({
      where: { tenantId },
      orderBy: { date: "desc" },
      take: 20,
    }),
    prisma.balanceSnapshot.findMany({
      where: {
        tenantId,
        snapshotDate: { gte: sixMonthsAgo },
      },
      orderBy: { snapshotDate: "desc" },
    }),
  ]);

  // Normalize Prisma Decimals to plain numbers for JSON serialization
  const normalizedTenant = tenant
    ? {
        ...tenant,
        balance: Number(tenant.balance),
        actualRent: Number(tenant.actualRent),
        marketRent: Number(tenant.marketRent),
        legalRent: Number(tenant.legalRent),
        monthsOwed: Number(tenant.monthsOwed),
      }
    : null;

  const normalizedSnapshot = latestARSnapshot
    ? {
        ...latestARSnapshot,
        balance0_30: Number(latestARSnapshot.balance0_30),
        balance31_60: Number(latestARSnapshot.balance31_60),
        balance61_90: Number(latestARSnapshot.balance61_90),
        balance90plus: Number(latestARSnapshot.balance90plus),
        totalBalance: Number(latestARSnapshot.totalBalance),
      }
    : null;

  const normalizedPayments = payments.map((p) => ({
    ...p,
    amount: Number(p.amount),
  }));

  const normalizedBalanceHistory = balanceHistory.map((s) => ({
    ...s,
    currentCharges: Number(s.currentCharges),
    currentBalance: Number(s.currentBalance),
    pastDueBalance: Number(s.pastDueBalance),
  }));

  return {
    tenant: normalizedTenant,
    legalCase,
    latestARSnapshot: normalizedSnapshot,
    collectionCase,
    collectionNotes,
    tenantNotes,
    payments: normalizedPayments,
    balanceHistory: normalizedBalanceHistory,
  };
}

// ── createCollectionNote ──────────────────────────────────────

interface CreateNoteData {
  content: string;
  actionType: CollectionActionType;
  followUpDate?: Date;
}

export async function createCollectionNote(
  user: ScopeUser & { id: string },
  tenantId: string,
  data: CreateNoteData
) {
  const buildingId = await verifyBuildingAccess(user, tenantId);

  return prisma.collectionNote.create({
    data: {
      tenantId,
      buildingId,
      authorId: user.id,
      content: data.content,
      actionType: data.actionType,
      followUpDate: data.followUpDate ?? null,
    },
    include: { author: { select: { id: true, name: true } } },
  });
}

// ── updateCollectionStatus — upserts CollectionCase ──

export async function updateCollectionStatus(
  user: ScopeUser,
  tenantId: string,
  status: string
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, unitId: true, unit: { select: { buildingId: true } } },
  });
  if (!tenant) throw new ApiError("Tenant not found", 404);
  if (!(await canAccessBuilding(user, tenant.unit.buildingId))) throw new ApiError("Forbidden", 403);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.collectionCase.findFirst({
      where: { tenantId, isActive: true },
    });

    if (existing) {
      return tx.collectionCase.update({
        where: { id: existing.id },
        data: { status, lastActionDate: new Date() },
      });
    }

    return tx.collectionCase.create({
      data: {
        buildingId: tenant.unit.buildingId,
        unitId: tenant.unitId,
        tenantId,
        status,
      },
    });
  });
}

// ── getARReport — reads from Tenant model directly ───────────

interface ARReportFilters {
  buildingId?: string;
  status?: string;
  minBalance?: number;
  noActivity30?: boolean;
  page?: number;
  pageSize?: number;
}

interface ARTenantRow {
  id: string;
  name: string;
  balance: number;
  arrearsCategory: string;
  arrearsDays: number;
  leaseStatus: string;
  inLegal: boolean;
  buildingAddress: string;
  buildingId: string;
  unitNumber: string;
  lastNoteDate: string | null;
  lastNoteText: string | null;
  collectionStatus: string | null;
  collectionNoteDate: string | null;
  collectionNoteText: string | null;
}

interface ARReportResult {
  data: ARTenantRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getARReport(
  user: ScopeUser,
  filters: ARReportFilters = {}
): Promise<ARReportResult> {
  const scope = getTenantScope(user, filters.buildingId);
  if (scope === EMPTY_SCOPE) {
    return { data: [], total: 0, page: 1, pageSize: 50 };
  }

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;

  const where: any = {
    ...(scope as object),
    isDeleted: false,
    balance: { gt: filters.minBalance ?? 0 },
  };

  if (filters.status === "LEGAL") {
    where.legalCases = { some: { isActive: true, inLegal: true } };
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { balance: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        balance: true,
        arrearsCategory: true,
        arrearsDays: true,
        leaseStatus: true,
        legalCases: { where: { isActive: true }, select: { inLegal: true }, take: 1 },
        unit: {
          select: {
            unitNumber: true,
            building: { select: { id: true, address: true } },
          },
        },
        notes: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { text: true, createdAt: true },
        },
        collectionCases: {
          where: { isActive: true },
          take: 1,
          select: { status: true },
        },
        collectionNotes: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true },
        },
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  const data: ARTenantRow[] = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    balance: Number(t.balance),
    arrearsCategory: t.arrearsCategory,
    arrearsDays: t.arrearsDays,
    leaseStatus: t.leaseStatus,
    inLegal: t.legalCases[0]?.inLegal === true,
    buildingAddress: t.unit.building.address,
    buildingId: t.unit.building.id,
    unitNumber: t.unit.unitNumber,
    lastNoteDate: t.notes[0]?.createdAt?.toISOString() ?? null,
    lastNoteText: t.notes[0]?.text ?? null,
    collectionStatus: t.collectionCases[0]?.status ?? null,
    collectionNoteDate: t.collectionNotes[0]?.createdAt?.toISOString() ?? null,
    collectionNoteText: t.collectionNotes[0]?.content ?? null,
  }));

  return { data, total, page, pageSize };
}

// ── bulkCollectionAction ──────────────────────────────────────

interface BulkActionData {
  tenantIds: string[];
  action: "change_status" | "add_note";
  value?: string;
  note?: string;
}

export async function bulkCollectionAction(
  user: ScopeUser & { id: string },
  data: BulkActionData
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];

  // Verify all tenant IDs are in scope
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: data.tenantIds }, isDeleted: false },
    select: { id: true, unitId: true, unit: { select: { buildingId: true } } },
  });

  const tenantMap = new Map(tenants.map((t) => [t.id, t]));
  for (const id of data.tenantIds) {
    const t = tenantMap.get(id);
    if (!t) {
      throw new ApiError(`Tenant ${id} not found`, 404);
    }
    if (!(await canAccessBuilding(user, t.unit.buildingId))) {
      throw new ApiError("One or more tenants are outside your building scope", 403);
    }
  }

  let updated = 0;

  if (data.action === "change_status" && data.value) {
    await prisma.$transaction(async (tx) => {
      for (const t of tenants) {
        const existing = await tx.collectionCase.findFirst({
          where: { tenantId: t.id, isActive: true },
        });
        if (existing) {
          await tx.collectionCase.update({
            where: { id: existing.id },
            data: { status: data.value!, lastActionDate: new Date() },
          });
        } else {
          await tx.collectionCase.create({
            data: {
              buildingId: t.unit.buildingId,
              unitId: t.unitId,
              tenantId: t.id,
              status: data.value!,
            },
          });
        }
        updated++;
      }
    });
  } else if (data.action === "add_note" && data.note) {
    await prisma.$transaction(async (tx) => {
      for (const t of tenants) {
        await tx.collectionNote.create({
          data: {
            tenantId: t.id,
            buildingId: t.unit.buildingId,
            authorId: user.id,
            content: data.note!,
            actionType: "OTHER",
          },
        });
        updated++;
      }
    });
  }

  return { updated, errors };
}

// ── sendToLegal ───────────────────────────────────────────────

export async function sendToLegal(
  user: ScopeUser & { id: string },
  tenantId: string
): Promise<{ legalCaseId: string }> {
  // Pre-flight access check (outside transaction for fast rejection)
  const tenantCheck = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, unit: { select: { buildingId: true } } },
  });
  if (!tenantCheck) throw new ApiError("Tenant not found", 404);
  if (!(await canAccessBuilding(user, tenantCheck.unit.buildingId))) throw new ApiError("Forbidden", 403);

  const result = await prisma.$transaction(async (tx) => {
    // Re-read tenant inside transaction for consistent balance
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, balance: true, unitId: true, unit: { select: { buildingId: true } } },
    });
    if (!tenant) throw new ApiError("Tenant not found", 404);

    // Check for existing active legal case inside transaction
    const existingLegal = await tx.legalCase.findFirst({
      where: { tenantId, isActive: true },
    });
    if (existingLegal) {
      throw new ApiError("Tenant already has an active legal case", 409);
    }

    // Find or create active collection case
    const collectionCase = await tx.collectionCase.findFirst({
      where: { tenantId, isActive: true },
    });

    // Update or create collection case with legal_referred status
    let caseId = collectionCase?.id;
    if (collectionCase) {
      await tx.collectionCase.update({
        where: { id: collectionCase.id },
        data: { status: "legal_referred", lastActionDate: new Date() },
      });
    } else {
      const created = await tx.collectionCase.create({
        data: {
          buildingId: tenant.unit.buildingId,
          unitId: tenant.unitId,
          tenantId,
          status: "legal_referred",
        },
      });
      caseId = created.id;
    }

    // Create legal case with consistent balance
    const legalCase = await tx.legalCase.create({
      data: {
        tenantId,
        buildingId: tenant.unit.buildingId,
        unitId: tenant.unitId,
        collectionCaseId: caseId,
        stage: "NOTICE_SENT",
        arrearsBalance: tenant.balance,
        inLegal: true,
        isActive: true,
      },
    });

    // Create collection note
    await tx.collectionNote.create({
      data: {
        tenantId,
        buildingId: tenant.unit.buildingId,
        authorId: user.id,
        content: "Referred to legal",
        actionType: "SENT_TO_LEGAL",
      },
    });

    return legalCase;
  });

  return { legalCaseId: result.id };
}

// ── recalculateTenantBalance — canonical balance update path ──

interface RecalcResult {
  tenantId: string;
  balance: number;
  arrearsCategory: string;
  arrearsDays: number;
  collectionScore: number;
  monthsOwed: number;
}

/**
 * Canonical function for recalculating a tenant's financial state.
 * Called after: AR import, rent-roll import, manual payment entry.
 * Future API ingestion plugs in here with one call.
 */
export async function recalculateTenantBalance(tenantId: string): Promise<RecalcResult> {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        id: true,
        balance: true,
        actualRent: true,
        marketRent: true,
        legalRent: true,
        leaseExpiration: true,
        payments: {
          orderBy: { date: "desc" },
          take: 1,
          select: { date: true, amount: true },
        },
        arSnapshots: {
          orderBy: { snapshotDate: "desc" },
          take: 1,
          select: {
            balance0_30: true,
            balance31_60: true,
            balance61_90: true,
            balance90plus: true,
            totalBalance: true,
          },
        },
        legalCases: {
          where: { isActive: true },
          take: 1,
          select: { id: true },
        },
      },
    });

    const snap = tenant.arSnapshots[0];
    const lastPayment = tenant.payments[0];
    const inLegal = tenant.legalCases.length > 0;

    // Use AR snapshot buckets if available, otherwise derive from tenant.balance
    const totalBalance = snap ? Number(snap.totalBalance) : Number(tenant.balance);
    const b0_30 = snap ? Number(snap.balance0_30) : totalBalance;
    const b31_60 = snap ? Number(snap.balance31_60) : 0;
    const b61_90 = snap ? Number(snap.balance61_90) : 0;
    const b90plus = snap ? Number(snap.balance90plus) : 0;

    // Derive arrears category from worst bucket
    let arrearsCategory = "current";
    if (totalBalance <= 0) arrearsCategory = "current";
    else if (b90plus > 0) arrearsCategory = "120+";
    else if (b61_90 > 0) arrearsCategory = "90";
    else if (b31_60 > 0) arrearsCategory = "60";
    else if (b0_30 > 0) arrearsCategory = "30";

    // Derive arrears days from category
    const arrearsDaysMap: Record<string, number> = {
      current: 0, "30": 30, "60": 60, "90": 90, "120+": 120,
    };
    const arrearsDays = arrearsDaysMap[arrearsCategory] ?? 0;

    // Calculate months owed based on rent
    const rent = Math.max(Number(tenant.actualRent), Number(tenant.marketRent), Number(tenant.legalRent));
    const monthsOwed = rent > 0 ? Math.round((totalBalance / rent) * 10) / 10 : 0;

    // Collection score — use canonical algorithm from scoring.ts
    const leaseStatus = getLeaseStatus(tenant.leaseExpiration);
    const collectionScore = calcCollectionScore({
      balance: totalBalance,
      marketRent: rent,
      arrearsDays,
      leaseStatus,
      legalFlag: inLegal,
      legalRecommended: false,
      isVacant: false,
    });

    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        balance: totalBalance,
        arrearsCategory,
        arrearsDays,
        monthsOwed,
        collectionScore,
      },
    });

    return {
      tenantId,
      balance: totalBalance,
      arrearsCategory,
      arrearsDays,
      collectionScore,
      monthsOwed,
    };
  });
}

/**
 * Recalculate balances for a batch of tenants (e.g., after import).
 * Returns counts of updated and errored tenants.
 */
export async function recalculateBatch(
  tenantIds: string[]
): Promise<{ updated: number; errors: Array<{ tenantId: string; error: string }> }> {
  let updated = 0;
  const errors: Array<{ tenantId: string; error: string }> = [];

  for (const id of tenantIds) {
    try {
      await recalculateTenantBalance(id);
      updated++;
    } catch (err) {
      errors.push({ tenantId: id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { updated, errors };
}

// ── getFullARReport — aggregated aging report ─────────────────

import type { ARReportData, ARAgingBuildingRow, ARTenantDetailRow } from "@/lib/collections/types";

export type { ScopeUser };

interface FullARReportFilters {
  buildingId?: string;
  month?: string; // YYYY-MM
}

export async function getFullARReport(
  user: ScopeUser,
  filters: FullARReportFilters = {}
): Promise<ARReportData> {
  const scope = getTenantScope(user, filters.buildingId);
  if (scope === EMPTY_SCOPE) {
    const now = new Date();
    return {
      generatedAt: now.toISOString(),
      period: { month: String(now.getMonth() + 1).padStart(2, "0"), year: now.getFullYear() },
      summary: { totalBalance: 0, tenantCount: 0, avgDaysOutstanding: 0, largestBalance: 0 },
      agingByBuilding: [],
      tenants: [],
      activity: { notesByType: {}, statusChanges: 0, top5ByBalance: [] },
    };
  }

  // Parse month filter
  const now = new Date();
  let reportMonth: number;
  let reportYear: number;
  if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    const [y, m] = filters.month.split("-").map(Number);
    reportYear = y;
    reportMonth = m;
  } else {
    reportYear = now.getFullYear();
    reportMonth = now.getMonth() + 1;
  }

  const monthStart = new Date(reportYear, reportMonth - 1, 1);
  const monthEnd = new Date(reportYear, reportMonth, 0, 23, 59, 59, 999);

  // Fetch tenants with balance > 0
  const tenants = await prisma.tenant.findMany({
    where: {
      ...(scope as object),
      isDeleted: false,
      balance: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      balance: true,
      arrearsDays: true,
      unit: {
        select: {
          unitNumber: true,
          building: { select: { id: true, address: true } },
        },
      },
      collectionCases: {
        where: { isActive: true },
        take: 1,
        select: { status: true },
      },
      collectionNotes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true },
      },
      arSnapshots: {
        orderBy: { snapshotDate: "desc" },
        take: 1,
        select: {
          balance0_30: true,
          balance31_60: true,
          balance61_90: true,
          balance90plus: true,
          totalBalance: true,
        },
      },
    },
    orderBy: { balance: "desc" },
  });

  // Build tenant detail rows
  const tenantRows: ARTenantDetailRow[] = tenants.map((t) => {
    const snap = t.arSnapshots[0];
    const balance = Number(t.balance);
    const lastNoteDate = t.collectionNotes[0]?.createdAt ?? null;
    const daysSinceNote = lastNoteDate
      ? Math.round((Date.now() - new Date(lastNoteDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      tenantId: t.id,
      tenantName: t.name,
      buildingAddress: t.unit.building.address,
      unit: t.unit.unitNumber,
      balance,
      current: snap ? Number(snap.balance0_30) : balance,
      days30: snap ? Number(snap.balance31_60) : 0,
      days60: snap ? Number(snap.balance61_90) : 0,
      days90: t.arrearsDays >= 120 ? 0 : (snap ? Number(snap.balance90plus) : 0),
      days120: t.arrearsDays >= 120 && snap ? Number(snap.balance90plus) : 0,
      status: t.collectionCases[0]?.status ?? "CURRENT",
      daysSinceNote,
      lastNote: t.collectionNotes[0]?.content ?? null,
    };
  });

  // Summary
  const totalBalance = tenantRows.reduce((s, t) => s + t.balance, 0);
  const tenantCount = tenantRows.length;
  const largestBalance = tenantRows.length > 0 ? tenantRows[0].balance : 0;
  const totalWeightedDays = tenants.reduce((s, t) => s + Number(t.balance) * t.arrearsDays, 0);
  const avgDaysOutstanding = totalBalance > 0 ? Math.round(totalWeightedDays / totalBalance) : 0;

  // Aging by building
  const buildingMap = new Map<string, ARAgingBuildingRow>();
  for (const t of tenantRows) {
    const key = t.buildingAddress;
    const existing = buildingMap.get(key);
    if (existing) {
      existing.current += t.current;
      existing.days30 += t.days30;
      existing.days60 += t.days60;
      existing.days90 += t.days90;
      existing.days120 += t.days120;
      existing.total += t.balance;
    } else {
      const bid = tenants.find((x) => x.unit.building.address === key)?.unit.building.id ?? "";
      buildingMap.set(key, {
        buildingId: bid,
        buildingAddress: key,
        current: t.current,
        days30: t.days30,
        days60: t.days60,
        days90: t.days90,
        days120: t.days120,
        total: t.balance,
        pctOfAR: 0,
      });
    }
  }
  const agingByBuilding = Array.from(buildingMap.values())
    .map((b) => ({ ...b, pctOfAR: totalBalance > 0 ? Math.round((b.total / totalBalance) * 10000) / 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  // Activity for the month
  const tenantIds = tenants.map((t) => t.id);

  const [notesThisMonth, statusChanges] = await Promise.all([
    tenantIds.length > 0
      ? prisma.collectionNote.findMany({
          where: {
            tenantId: { in: tenantIds },
            createdAt: { gte: monthStart, lte: monthEnd },
          },
          select: { actionType: true },
        })
      : Promise.resolve([]),
    tenantIds.length > 0
      ? prisma.collectionCase.count({
          where: {
            tenantId: { in: tenantIds },
            lastActionDate: { gte: monthStart, lte: monthEnd },
          },
        })
      : Promise.resolve(0),
  ]);

  const notesByType: Record<string, number> = {};
  for (const n of notesThisMonth) {
    notesByType[n.actionType] = (notesByType[n.actionType] ?? 0) + 1;
  }

  const top5ByBalance = tenantRows.slice(0, 5).map((t) => ({
    tenantName: t.tenantName,
    balance: t.balance,
    lastNoteDate: t.lastNote ? (tenants.find((x) => x.id === t.tenantId)?.collectionNotes[0]?.createdAt?.toISOString() ?? null) : null,
  }));

  return {
    generatedAt: new Date().toISOString(),
    period: { month: String(reportMonth).padStart(2, "0"), year: reportYear },
    summary: { totalBalance, tenantCount, avgDaysOutstanding, largestBalance },
    agingByBuilding,
    tenants: tenantRows,
    activity: { notesByType, statusChanges, top5ByBalance },
  };
}

// ── Collection Alerts ─────────────────────────────────────────

export interface CollectionAlert {
  tenantId: string;
  tenantName: string;
  buildingAddress: string;
  unit: string;
  balance: number;
  alertType: "PAYMENT_OVERDUE_90" | "CONTACT_OVERDUE_30" | "HIGH_BALANCE_NO_LEGAL";
  alertMessage: string;
  daysSinceContact: number | null;
  priority: "HIGH" | "MEDIUM";
}

export async function getCollectionAlerts(user: ScopeUser): Promise<CollectionAlert[]> {
  const scope = getTenantScope(user);
  if (scope === EMPTY_SCOPE) return [];

  const tenants = await prisma.tenant.findMany({
    where: {
      ...(scope as object),
      isDeleted: false,
      balance: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      balance: true,
      unit: {
        select: {
          unitNumber: true,
          building: { select: { address: true } },
        },
      },
      legalCases: { where: { isActive: true }, select: { inLegal: true }, take: 1 },
      collectionNotes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      payments: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
    },
  });

  const alerts: CollectionAlert[] = [];
  const seen = new Set<string>();

  for (const t of tenants) {
    const balance = Number(t.balance);
    const lastNoteDate = t.collectionNotes[0]?.createdAt ?? null;
    const lastPaymentDate = t.payments[0]?.date ?? null;
    const daysSinceContact = lastNoteDate
      ? Math.round((Date.now() - new Date(lastNoteDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const daysSincePayment = lastPaymentDate
      ? Math.round((Date.now() - new Date(lastPaymentDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const inLegal = t.legalCases[0]?.inLegal === true;

    const base = {
      tenantId: t.id,
      tenantName: t.name,
      buildingAddress: t.unit.building.address,
      unit: t.unit.unitNumber,
      balance,
      daysSinceContact,
    };

    // Rule 1: 90-day no payment (HIGH priority)
    if ((daysSincePayment === null || daysSincePayment > 90) && !seen.has(t.id)) {
      alerts.push({
        ...base,
        alertType: "PAYMENT_OVERDUE_90",
        alertMessage: daysSincePayment === null
          ? "No payment ever recorded"
          : `No payment in ${daysSincePayment} days`,
        priority: "HIGH",
      });
      seen.add(t.id);
      continue;
    }

    // Rule 3: High balance no legal (HIGH priority)
    if (balance > 5000 && !inLegal && !seen.has(t.id)) {
      alerts.push({
        ...base,
        alertType: "HIGH_BALANCE_NO_LEGAL",
        alertMessage: "Balance over $5,000 with no legal action",
        priority: "HIGH",
      });
      seen.add(t.id);
      continue;
    }

    // Rule 2: 30-day no contact (MEDIUM priority)
    if ((daysSinceContact === null || daysSinceContact > 30) && !seen.has(t.id)) {
      alerts.push({
        ...base,
        alertType: "CONTACT_OVERDUE_30",
        alertMessage: daysSinceContact === null
          ? "Never contacted"
          : `No contact in ${daysSinceContact} days`,
        priority: "MEDIUM",
      });
      seen.add(t.id);
    }
  }

  // Sort: HIGH priority first, then by balance descending
  return alerts.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "HIGH" ? -1 : 1;
    return b.balance - a.balance;
  });
}
