import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { canAccessBuilding } from "@/lib/data-scope";
import { utilityCheckCreateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const account = await prisma.utilityAccount.findUnique({
    where: { id },
    include: { meter: { select: { buildingId: true } } },
  });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, account.meter.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const checks = await prisma.utilityMonthlyCheck.findMany({
    where: { utilityAccountId: id },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return NextResponse.json(checks);
}, "utilities");

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const account = await prisma.utilityAccount.findUnique({
    where: { id },
    include: { meter: { select: { buildingId: true } } },
  });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, account.meter.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { month, year, isPaid, paidDate, amount, notes } = await parseBody(req, utilityCheckCreateSchema);

  const paymentStatus = isPaid ? "paid" : "unpaid";
  const resolvedPaidDate = isPaid ? (paidDate ? new Date(paidDate) : new Date()) : null;

  // Upsert — if check exists for this month/year, update it; otherwise create
  const check = await prisma.utilityMonthlyCheck.upsert({
    where: {
      utilityAccountId_month_year: {
        utilityAccountId: id,
        month,
        year,
      },
    },
    update: {
      paymentStatus,
      verifiedAt: resolvedPaidDate,
      verifiedBy: user.id,
      notes: notes ?? undefined,
    },
    create: {
      utilityAccountId: id,
      month,
      year,
      paymentStatus,
      verifiedAt: resolvedPaidDate,
      verifiedBy: user.id,
      notes: notes || null,
    },
  });

  return NextResponse.json(check, { status: 201 });
}, "utilities");
