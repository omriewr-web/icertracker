import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { tenantUpdateSchema } from "@/lib/validations";
import { getArrearsCategory, getArrearsDays, getLeaseStatus, calcCollectionScore } from "@/lib/scoring";
import { assertTenantAccess } from "@/lib/data-scope";
import { toNumber } from "@/lib/utils/decimal";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      unit: { include: { building: true } },
      legalCases: { where: { isActive: true }, take: 1 },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      payments: { orderBy: { date: "desc" }, include: { recorder: { select: { name: true } } } },
      leases: {
        orderBy: { createdAt: "desc" },
        include: {
          recurringCharges: { where: { active: true } },
          balanceSnapshots: { orderBy: { snapshotDate: "desc" }, take: 5 },
        },
      },
      balanceSnapshots: { orderBy: { snapshotDate: "desc" }, take: 1 },
    },
  });

  if (!tenant || tenant.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tenant);
});

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const data = await parseBody(req, tenantUpdateSchema);

  const current = await prisma.tenant.findUnique({ where: { id }, include: { legalCases: { where: { isActive: true }, take: 1 } } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const balance = data.balance ?? toNumber(current.balance);
  const marketRent = data.marketRent ?? toNumber(current.marketRent);
  const leaseExp = data.leaseExpiration !== undefined
    ? (data.leaseExpiration ? new Date(data.leaseExpiration) : null)
    : current.leaseExpiration;

  const arrearsCategory = getArrearsCategory(balance, marketRent);
  const arrearsDays = getArrearsDays(balance, marketRent);
  const leaseStatus = getLeaseStatus(leaseExp);
  const monthsOwed = marketRent > 0 ? balance / marketRent : 0;

  const collectionScore = calcCollectionScore({
    balance,
    marketRent,
    arrearsDays,
    leaseStatus,
    legalFlag: current.legalCases?.[0]?.inLegal ?? false,
    legalRecommended: false,
    isVacant: false,
  });

  const updateData: any = { ...data };
  if (data.leaseExpiration !== undefined) {
    updateData.leaseExpiration = data.leaseExpiration ? new Date(data.leaseExpiration) : null;
  }
  if (data.moveInDate !== undefined) {
    updateData.moveInDate = data.moveInDate ? new Date(data.moveInDate) : null;
  }

  Object.assign(updateData, {
    arrearsCategory,
    arrearsDays,
    leaseStatus,
    monthsOwed,
    collectionScore,
  });

  const tenant = await prisma.tenant.update({ where: { id }, data: updateData });

  // Dual-write: sync Lease record
  const unitInfo = await prisma.unit.findUnique({
    where: { id: tenant.unitId },
    select: { buildingId: true, building: { select: { organizationId: true } } },
  });

  await prisma.lease.upsert({
    where: { id: `${id}-lease` },
    create: {
      id: `${id}-lease`,
      organizationId: unitInfo?.building?.organizationId ?? null,
      buildingId: unitInfo?.buildingId ?? null,
      unitId: tenant.unitId,
      tenantId: id,
      isCurrent: true,
      leaseStart: tenant.moveInDate,
      leaseEnd: tenant.leaseExpiration,
      moveInDate: tenant.moveInDate,
      monthlyRent: toNumber(tenant.marketRent),
      legalRent: toNumber(tenant.legalRent),
      securityDeposit: toNumber(tenant.deposit),
      currentBalance: toNumber(tenant.balance),
      chargeCode: tenant.chargeCode ?? null,
      isStabilized: tenant.isStabilized,
      status: tenant.leaseExpiration
        ? (tenant.leaseExpiration < new Date() ? "EXPIRED" : "ACTIVE")
        : "MONTH_TO_MONTH",
    },
    update: {
      leaseStart: tenant.moveInDate,
      leaseEnd: tenant.leaseExpiration,
      moveInDate: tenant.moveInDate,
      monthlyRent: toNumber(tenant.marketRent),
      legalRent: toNumber(tenant.legalRent),
      securityDeposit: toNumber(tenant.deposit),
      currentBalance: toNumber(tenant.balance),
      chargeCode: tenant.chargeCode ?? null,
      isStabilized: tenant.isStabilized,
      status: tenant.leaseExpiration
        ? (tenant.leaseExpiration < new Date() ? "EXPIRED" : "ACTIVE")
        : "MONTH_TO_MONTH",
    },
  });

  return NextResponse.json(tenant);
}, "edit");

export const DELETE = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (tenant.isDeleted) return NextResponse.json({ error: "Already deleted" }, { status: 410 });

  await prisma.$transaction(async (tx) => {
    // End the associated lease (if any)
    const leaseId = `${id}-lease`;
    const existingLease = await tx.lease.findUnique({ where: { id: leaseId } });
    if (existingLease) {
      await tx.lease.update({
        where: { id: leaseId },
        data: { isCurrent: false, status: "TERMINATED", moveOutDate: new Date() },
      });
    }

    // Soft delete — preserve all legal/financial history
    await tx.tenant.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    // Mark unit as vacant
    await tx.unit.update({ where: { id: tenant.unitId }, data: { isVacant: true } });
  });

  return NextResponse.json({ success: true });
}, "edit");
