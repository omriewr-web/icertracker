import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { paymentCreateSchema } from "@/lib/validations";
import { assertTenantAccess } from "@/lib/data-scope";
import { recalculateTenantBalance } from "@/lib/services/collections.service";
import { captureBusinessMessage, captureSentryException } from "@/lib/sentry-observability";

export const dynamic = "force-dynamic";

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
    }).catch((error) => {
      captureBusinessMessage("Failed payment recording", {
        level: "error",
        tags: {
          tenantId: id,
          userId: user.id,
        },
        extra: {
          method: data.method,
          amount: data.amount,
        },
        fingerprint: ["payment-record-failed", id],
      });
      captureSentryException(error, {
        level: "error",
        tags: {
          tenantId: id,
          userId: user.id,
        },
        extra: {
          method: data.method,
          amount: data.amount,
        },
      });
      throw error;
    });

    // Recalculate tenant balance after payment recorded
  await recalculateTenantBalance(id).catch((error) => {
    captureBusinessMessage("Failed payment recording", {
      level: "error",
      tags: {
        tenantId: id,
        userId: user.id,
      },
      extra: {
        method: data.method,
        amount: data.amount,
        step: "recalculate-balance",
      },
      fingerprint: ["payment-record-failed", id, "recalculate-balance"],
    });
    captureSentryException(error, {
      level: "error",
      tags: {
        tenantId: id,
        userId: user.id,
      },
      extra: {
        method: data.method,
        amount: data.amount,
        step: "recalculate-balance",
      },
    });
    throw error;
  });

  return NextResponse.json(payment, { status: 201 });
}, "pay");
