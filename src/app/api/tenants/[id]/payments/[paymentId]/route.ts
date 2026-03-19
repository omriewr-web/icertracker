import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { assertTenantAccess } from "@/lib/data-scope";
import { recalculateTenantBalance } from "@/lib/services/collections.service";

export const dynamic = "force-dynamic";

export const DELETE = withAuth(async (req, { user, params }) => {
  const { id, paymentId } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { tenantId: true } });
  if (!payment || payment.tenantId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.payment.delete({ where: { id: paymentId } });
  await recalculateTenantBalance(id);
  return NextResponse.json({ success: true });
}, "pay");
