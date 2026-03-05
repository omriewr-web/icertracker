import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { tenantUpdateSchema } from "@/lib/validations";
import { getArrearsCategory, getArrearsDays, getLeaseStatus, calcCollectionScore } from "@/lib/scoring";

export const GET = withAuth(async (req, { params }) => {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      unit: { include: { building: true } },
      legalCase: true,
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      payments: { orderBy: { date: "desc" }, include: { recorder: { select: { name: true } } } },
    },
  });

  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tenant);
});

export const PATCH = withAuth(async (req, { params }) => {
  const { id } = await params;
  const data = await parseBody(req, tenantUpdateSchema);

  const current = await prisma.tenant.findUnique({ where: { id }, include: { legalCase: true } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const balance = data.balance ?? Number(current.balance);
  const marketRent = data.marketRent ?? Number(current.marketRent);
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
    legalFlag: current.legalCase?.inLegal ?? false,
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
  return NextResponse.json(tenant);
}, "edit");

export const DELETE = withAuth(async (req, { params }) => {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.tenant.delete({ where: { id } });

  // Mark unit as vacant
  await prisma.unit.update({ where: { id: tenant.unitId }, data: { isVacant: true } });

  return NextResponse.json({ success: true });
}, "edit");
