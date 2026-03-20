import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { RGB_ORDERS } from "@/lib/constants/rgb-orders";

export const POST = withAuth(async (_req, { user }) => {
  // Only admin roles can seed
  const adminRoles = ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN"];
  if (!adminRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let created = 0;
  let skipped = 0;

  for (const order of RGB_ORDERS) {
    const orderNum = String(order.orderNumber);
    const existing = await prisma.rgbOrder.findUnique({
      where: { orderNumber: orderNum },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.rgbOrder.create({
      data: {
        orderNumber: orderNum,
        effectiveFrom: new Date(order.effectiveDate),
        effectiveTo: new Date(`${order.year + 1}-09-30`),
        oneYearPct: order.oneYearIncrease / 100,
        twoYearPct: order.twoYearIncrease / 100,
        notes: order.notes ?? null,
      },
    });
    created++;
  }

  return NextResponse.json({ created, skipped, total: RGB_ORDERS.length });
}, "edit");
