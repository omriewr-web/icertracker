import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, buildWhereClause, parseBody } from "@/lib/api-helpers";
import { tenantCreateSchema } from "@/lib/validations";
import { TenantView } from "@/types";
import { getArrearsCategory, getArrearsDays, getLeaseStatus, calcCollectionScore } from "@/lib/scoring";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const search = url.searchParams.get("search");
  const arrears = url.searchParams.get("arrears");
  const lease = url.searchParams.get("lease");
  const sortField = url.searchParams.get("sort") || "balance";
  const sortDir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";

  const where: any = buildWhereClause(user, buildingId);

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

  const tenants = await prisma.tenant.findMany({
    where,
    include: {
      unit: {
        include: {
          building: { select: { id: true, address: true, region: true, entity: true, portfolio: true } },
        },
      },
      legalCase: { select: { inLegal: true, stage: true } },
      _count: { select: { notes: true, payments: true, tasks: true } },
    },
    orderBy: sortField === "name" ? { name: sortDir } :
             sortField === "balance" ? { balance: sortDir } :
             sortField === "collectionScore" ? { collectionScore: sortDir } :
             sortField === "arrearsDays" ? { arrearsDays: sortDir } :
             { balance: "desc" },
  });

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
    buildingAddress: t.unit.building.address,
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
    monthsOwed: Number(t.monthsOwed),
    leaseStatus: t.leaseStatus as any,
    collectionScore: t.collectionScore,
    legalFlag: t.legalCase?.inLegal ?? false,
    legalStage: t.legalCase?.stage?.toLowerCase().replace(/_/g, "-") as any ?? null,
    legalRecommended: t.collectionScore >= 60 && !t.legalCase?.inLegal,
    noteCount: t._count.notes,
    paymentCount: t._count.payments,
    taskCount: t._count.tasks,
  }));

  return NextResponse.json(result);
});

export const POST = withAuth(async (req) => {
  const data = await parseBody(req, tenantCreateSchema);

  // Find or create unit
  let unit = await prisma.unit.findUnique({
    where: { buildingId_unitNumber: { buildingId: data.buildingId, unitNumber: data.unitNumber } },
  });
  if (!unit) {
    unit = await prisma.unit.create({
      data: { buildingId: data.buildingId, unitNumber: data.unitNumber },
    });
  }

  // Check if unit already has a tenant
  const existingTenant = await prisma.tenant.findUnique({ where: { unitId: unit.id } });
  if (existingTenant) {
    return NextResponse.json({ error: "Unit already has a tenant" }, { status: 400 });
  }

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

  const tenant = await prisma.tenant.create({
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

  // Mark unit as occupied
  await prisma.unit.update({ where: { id: unit.id }, data: { isVacant: false } });

  return NextResponse.json(tenant, { status: 201 });
}, "edit");
