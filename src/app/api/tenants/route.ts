import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { tenantCreateSchema } from "@/lib/validations";
import { TenantView } from "@/types";
import { getTenantScope, EMPTY_SCOPE, assertBuildingAccess } from "@/lib/data-scope";
import { getArrearsCategory, getArrearsDays, getLeaseStatus, calcCollectionScore } from "@/lib/scoring";
import { getDisplayAddress } from "@/lib/building-matching";
import { scoreLegalCandidate } from "@/lib/legal-matching";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const orgFilter = isAdmin
    ? {}
    : user.organizationId
      ? { organizationId: user.organizationId }
      : null;

  if (orgFilter === null) {
    return NextResponse.json({ tenants: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
  }

  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const search = url.searchParams.get("search");
  const arrears = url.searchParams.get("arrears");
  const lease = url.searchParams.get("lease");
  const sortField = url.searchParams.get("sort") || "balance";
  const sortDir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "50")), 100);
  const skip = (page - 1) * limit;

  const scope = getTenantScope(user, buildingId);
  if (scope === EMPTY_SCOPE) return NextResponse.json({ tenants: [], pagination: { page, limit, total: 0, totalPages: 0 } });

  const where: any = { ...scope };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { unit: { unitNumber: { contains: search, mode: "insensitive" } } },
      { unit: { building: { address: { contains: search, mode: "insensitive" } } } },
      { yardiResidentId: { contains: search, mode: "insensitive" } },
    ];
  }

  if (arrears && arrears !== "all") {
    where.arrearsCategory = arrears;
  }

  if (lease && lease !== "all") {
    where.leaseStatus = lease;
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        unit: {
          include: {
            building: { select: { id: true, address: true, altAddress: true, region: true, entity: true, portfolio: true } },
          },
        },
        legalCases: { where: { isActive: true }, select: { inLegal: true, stage: true }, take: 1 },
        _count: { select: { notes: true, payments: true, tasks: true } },
      },
      orderBy: sortField === "name" ? { name: sortDir } :
               sortField === "balance" ? { balance: sortDir } :
               sortField === "collectionScore" ? { collectionScore: sortDir } :
               sortField === "arrearsDays" ? { arrearsDays: sortDir } :
               { balance: "desc" as const },
      skip,
      take: limit,
    }),
    prisma.tenant.count({ where }),
  ]);

  const result: TenantView[] = tenants.map((t) => ({
    id: t.id,
    unitId: t.unitId,
    yardiResidentId: t.yardiResidentId,
    name: t.name,
    email: t.email,
    phone: t.phone,
    unitNumber: t.unit.unitNumber,
    unitType: t.unit.unitType,
    buildingId: t.unit.building.id,
    buildingAddress: getDisplayAddress(t.unit.building),
    buildingRegion: t.unit.building.region,
    entity: t.unit.building.entity,
    portfolio: t.unit.building.portfolio,
    marketRent: Number(t.marketRent),
    legalRent: Number(t.legalRent),
    dhcrLegalRent: Number(t.dhcrLegalRent),
    prefRent: Number(t.prefRent),
    actualRent: Number(t.actualRent),
    chargeCode: t.chargeCode,
    isStabilized: t.isStabilized,
    deposit: Number(t.deposit),
    moveInDate: t.moveInDate?.toISOString() ?? null,
    leaseExpiration: t.leaseExpiration?.toISOString() ?? null,
    moveOutDate: t.moveOutDate?.toISOString() ?? null,
    balance: Number(t.balance),
    arrearsCategory: t.arrearsCategory as any,
    arrearsDays: t.arrearsDays,
    monthsOwed: t.balance && t.marketRent ? Math.round((Number(t.balance) / Number(t.marketRent)) * 10) / 10 : 0,
    leaseStatus: t.leaseStatus as any,
    collectionScore: t.collectionScore,
    legalFlag: !!t.legalCases[0]?.inLegal,
    legalStage: (t.legalCases[0]?.stage as any) || null,
    legalRecommended: (() => {
      const hasActiveCase = !!t.legalCases[0]?.inLegal;
      if (hasActiveCase) return false;
      const { score } = scoreLegalCandidate({
        balance: Number(t.balance),
        marketRent: Number(t.marketRent),
        collectionScore: t.collectionScore,
        arrearsCategory: t.arrearsCategory,
        leaseStatus: t.leaseStatus,
        arrearsDays: t.arrearsDays,
      });
      return score >= 40;
    })(),
    noteCount: t._count.notes,
    paymentCount: t._count.payments,
    taskCount: t._count.tasks,
  }));

  return NextResponse.json({
    tenants: result,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}, "dash");

export const POST = withAuth(async (req, { user }) => {
  const data = await parseBody(req, tenantCreateSchema);

  // Verify building access
  const accessErr = await assertBuildingAccess(user, data.buildingId);
  if (accessErr) return accessErr;

  const balance = 0;
  const marketRent = data.marketRent ?? 0;
  const leaseExp = data.leaseExpiration ? new Date(data.leaseExpiration) : null;

  const arrearsCategory = getArrearsCategory(balance, marketRent);
  const arrearsDays = getArrearsDays(balance, marketRent);
  const leaseStatus = getLeaseStatus(leaseExp);
  const collectionScore = calcCollectionScore({
    balance, marketRent, arrearsDays, leaseStatus,
    legalFlag: false, legalRecommended: false, isVacant: false,
  });

  const tenant = await prisma.$transaction(async (tx) => {
    // Find or create unit
    let unit = await tx.unit.findUnique({
      where: { buildingId_unitNumber: { buildingId: data.buildingId, unitNumber: data.unitNumber } },
    });
    if (!unit) {
      unit = await tx.unit.create({
        data: { buildingId: data.buildingId, unitNumber: data.unitNumber },
      });
    }

    // Check if unit already has a tenant
    const existingTenant = await tx.tenant.findUnique({ where: { unitId: unit.id } });
    if (existingTenant) {
      const err: any = new Error("Unit already has a tenant");
      err.status = 400;
      throw err;
    }

    const created = await tx.tenant.create({
      data: {
        unitId: unit.id,
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        marketRent: data.marketRent ?? 0,
        legalRent: data.legalRent ?? 0,
        deposit: data.deposit ?? 0,
        chargeCode: data.chargeCode ?? null,
        isStabilized: data.isStabilized ?? false,
        leaseExpiration: leaseExp,
        moveInDate: data.moveInDate ? new Date(data.moveInDate) : null,
        arrearsCategory,
        arrearsDays,
        leaseStatus,
        collectionScore,
        monthsOwed: 0,
      },
    });

    // Dual-write: create Lease record
    const buildingInfo = await tx.building.findUnique({
      where: { id: data.buildingId },
      select: { organizationId: true },
    });

    await tx.lease.upsert({
      where: { id: `${created.id}-lease` },
      create: {
        id: `${created.id}-lease`,
        organizationId: buildingInfo?.organizationId ?? null,
        buildingId: data.buildingId,
        unitId: unit.id,
        tenantId: created.id,
        isCurrent: true,
        leaseStart: data.moveInDate ? new Date(data.moveInDate) : null,
        leaseEnd: leaseExp,
        moveInDate: data.moveInDate ? new Date(data.moveInDate) : null,
        monthlyRent: data.marketRent ?? 0,
        legalRent: data.legalRent ?? 0,
        securityDeposit: data.deposit ?? 0,
        currentBalance: 0,
        chargeCode: data.chargeCode ?? null,
        isStabilized: data.isStabilized ?? false,
        status: leaseExp ? (leaseExp < new Date() ? "EXPIRED" : "ACTIVE") : "MONTH_TO_MONTH",
      },
      update: {},
    });

    // Mark unit as occupied
    await tx.unit.update({ where: { id: unit.id }, data: { isVacant: false } });

    return created;
  });

  return NextResponse.json(tenant, { status: 201 });
}, "edit");
