import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { canAccessBuilding } from "@/lib/data-scope";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const account = await prisma.utilityAccount.findUnique({
    where: { id },
    include: { meter: { select: { buildingId: true } } },
  });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessBuilding(user, account.meter.buildingId)) {
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
  if (!canAccessBuilding(user, account.meter.buildingId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { month, year, isPaid, paidDate, amount, notes } = body;

  // Validate month
  if (!month || !year || typeof month !== "number" || typeof year !== "number") {
    return NextResponse.json({ error: "month and year are required numbers" }, { status: 400 });
  }
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "month must be between 1 and 12" }, { status: 400 });
  }
  if (year < 2000 || year > 2099) {
    return NextResponse.json({ error: "year must be a valid 4-digit year" }, { status: 400 });
  }
  if (amount !== undefined && amount !== null && (typeof amount !== "number" || amount < 0)) {
    return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  }

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
