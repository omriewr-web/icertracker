import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { paymentCreateSchema } from "@/lib/validations";
import { assertTenantAccess } from "@/lib/data-scope";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const payments = await prisma.payment.findMany({
    where: { tenantId: id },
    include: { recorder: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(payments);
});

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertTenantAccess(user, id);
  if (denied) return denied;

  const data = await parseBody(req, paymentCreateSchema);
  const payment = await prisma.payment.create({
    data: {
      tenantId: id,
      recordedBy: user.id,
      amount: data.amount,
      date: new Date(data.date),
      method: data.method,
      reference: data.reference,
      notes: data.notes,
    },
    include: { recorder: { select: { name: true } } },
  });
  return NextResponse.json(payment, { status: 201 });
}, "pay");
