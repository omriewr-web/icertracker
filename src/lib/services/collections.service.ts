import { prisma } from "@/lib/prisma";
import { getTenantScope, getBuildingScope, EMPTY_SCOPE, canAccessBuilding } from "@/lib/data-scope";
import type { CollectionActionType, Prisma } from "@prisma/client";

// ── Helpers ───────────────────────────────────────────────────

interface ScopeUser {
  role: string;
  assignedProperties?: string[] | null;
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
  if (!canAccessBuilding(user, tenant.unit.buildingId)) throw new ApiError("Forbidden", 403);
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
      balance: { gt: 0 },
    },
    select: {
      id: true,
      balance: true,
      legalCase: { select: { inLegal: true } },
    },
  });

  const totalBalance = tenants.reduce((sum, t) => sum + Number(t.balance), 0);
  const legalCount = tenants.filter((t) => t.legalCase?.inLegal === true).length;

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
        leaseStatus: true,
        leaseExpiration: true,
        arrearsCategory: true,
        arrearsDays: true,
        monthsOwed: true,
        unit: {
          select: {
            unitNumber: true,
            building: { select: { id: true, address: true } },
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
  if (!canAccessBuilding(user, tenant.unit.buildingId)) throw new ApiError("Forbidden", 403);

  const existing = await prisma.collectionCase.findFirst({
    where: { tenantId, isActive: true },
  });

  if (existing) {
    return prisma.collectionCase.update({
      where: { id: existing.id },
      data: { status, lastActionDate: new Date() },
    });
  }

  return prisma.collectionCase.create({
    data: {
      buildingId: tenant.unit.buildingId,
      unitId: tenant.unitId,
      tenantId,
      status,
    },
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
    balance: { gt: filters.minBalance ?? 0 },
  };

  if (filters.status === "LEGAL") {
    where.legalCase = { inLegal: true };
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
        legalCase: { select: { inLegal: true } },
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
    inLegal: t.legalCase?.inLegal === true,
    buildingAddress: t.unit.building.address,
    buildingId: t.unit.building.id,
    unitNumber: t.unit.unitNumber,
    lastNoteDate: t.notes[0]?.createdAt?.toISOString() ?? null,
    lastNoteText: t.notes[0]?.text ?? null,
  }));

  return { data, total, page, pageSize };
}
