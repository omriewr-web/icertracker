import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { canAccessBuilding } from "@/lib/data-scope";
import { utilityCheckUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const dynamic = "force-dynamic";

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id, checkId } = await params;

  const check = await prisma.utilityMonthlyCheck.findUnique({
    where: { id: checkId },
    include: {
      account: {
        include: { meter: { select: { buildingId: true } } },
      },
    },
  });

  if (!check) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (check.utilityAccountId !== id) {
    return NextResponse.json({ error: "Check does not belong to this account" }, { status: 400 });
  }
  if (!(await canAccessBuilding(user, check.account.meter.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { isPaid, paidDate, notes } = await parseBody(req, utilityCheckUpdateSchema);

  const data: any = {};
  if (isPaid !== undefined) {
    data.paymentStatus = isPaid ? "paid" : "unpaid";
    data.verifiedAt = isPaid ? (paidDate ? new Date(paidDate) : new Date()) : null;
    data.verifiedBy = isPaid ? user.id : null;
  }
  if (notes !== undefined) data.notes = notes;

  const updated = await prisma.utilityMonthlyCheck.update({
    where: { id: checkId },
    data,
  });

  return NextResponse.json(updated);
}, "utilities");
