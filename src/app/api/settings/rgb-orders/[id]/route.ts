import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { getOrgScope } from "@/lib/data-scope";
import { z } from "zod";

// ── Helpers ────────────────────────────────────────────────────

function normalizeOrder(o: any) {
  return {
    ...o,
    oneYearPct: Number(o.oneYearPct),
    twoYearPct: Number(o.twoYearPct),
    twoYearY1Pct: o.twoYearY1Pct != null ? Number(o.twoYearY1Pct) : null,
    twoYearY2Pct: o.twoYearY2Pct != null ? Number(o.twoYearY2Pct) : null,
  };
}

// ── Validation ─────────────────────────────────────────────────

const patchSchema = z
  .object({
    orderNumber: z.string().min(1).optional(),
    effectiveFrom: z.string().min(1).optional(),
    effectiveTo: z.string().min(1).optional(),
    oneYearPct: z.number().min(0).max(0.15).optional(),
    twoYearPct: z.number().min(0).max(0.15).optional(),
    twoYearY1Pct: z.number().min(0).max(0.15).nullable().optional(),
    twoYearY2Pct: z.number().min(0).max(0.15).nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (d) => {
      if (d.effectiveFrom && d.effectiveTo) {
        return new Date(d.effectiveFrom) < new Date(d.effectiveTo);
      }
      return true;
    },
    { message: "effectiveFrom must be before effectiveTo", path: ["effectiveTo"] },
  );

// ── PATCH ──────────────────────────────────────────────────────

export const PATCH = withAuth(async (req: NextRequest, { user, params }) => {
  const { id } = await params;
  const data = await parseBody(req, patchSchema);

  const existing = await prisma.rgbOrder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // RgbOrder is global reference data (NYC Rent Guidelines Board orders).
  // Access is gated by the "edit" permission string on withAuth.

  // Resolve final date range for overlap check
  const from = data.effectiveFrom ? new Date(data.effectiveFrom) : existing.effectiveFrom;
  const to = data.effectiveTo ? new Date(data.effectiveTo) : existing.effectiveTo;

  const overlap = await prisma.rgbOrder.findFirst({
    where: {
      id: { not: id },
      AND: [
        { effectiveFrom: { lt: to } },
        { effectiveTo: { gt: from } },
      ],
    },
  });

  if (overlap) {
    return NextResponse.json(
      { error: `Date range overlaps with order ${overlap.orderNumber}` },
      { status: 409 },
    );
  }

  const updated = await prisma.rgbOrder.update({
    where: { id },
    data: {
      ...(data.orderNumber !== undefined && { orderNumber: data.orderNumber }),
      ...(data.effectiveFrom !== undefined && { effectiveFrom: new Date(data.effectiveFrom) }),
      ...(data.effectiveTo !== undefined && { effectiveTo: new Date(data.effectiveTo) }),
      ...(data.oneYearPct !== undefined && { oneYearPct: data.oneYearPct }),
      ...(data.twoYearPct !== undefined && { twoYearPct: data.twoYearPct }),
      ...(data.twoYearY1Pct !== undefined && { twoYearY1Pct: data.twoYearY1Pct }),
      ...(data.twoYearY2Pct !== undefined && { twoYearY2Pct: data.twoYearY2Pct }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });

  return NextResponse.json(normalizeOrder(updated));
}, "edit");

// ── DELETE ─────────────────────────────────────────────────────

export const DELETE = withAuth(async (_req: NextRequest, { user, params }) => {
  const { id } = await params;

  const order = await prisma.rgbOrder.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // RgbOrder is global reference data — access gated by "edit" permission.

  // Check if any tenant references this order number
  const referencedTenant = await prisma.tenant.findFirst({
    where: { rgbOrderApplied: order.orderNumber },
    select: { id: true },
  });

  if (referencedTenant) {
    return NextResponse.json(
      { error: "Cannot delete: this RGB order is referenced by existing tenants" },
      { status: 409 },
    );
  }

  await prisma.rgbOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}, "edit");
