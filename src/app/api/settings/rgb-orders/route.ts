import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
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

const createSchema = z
  .object({
    orderNumber: z.string().min(1, "Order number is required"),
    effectiveFrom: z.string().min(1, "Effective-from date is required"),
    effectiveTo: z.string().min(1, "Effective-to date is required"),
    oneYearPct: z.number().min(0).max(0.15),
    twoYearPct: z.number().min(0).max(0.15),
    twoYearY1Pct: z.number().min(0).max(0.15).nullable().optional(),
    twoYearY2Pct: z.number().min(0).max(0.15).nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .refine((d) => new Date(d.effectiveFrom) < new Date(d.effectiveTo), {
    message: "effectiveFrom must be before effectiveTo",
    path: ["effectiveTo"],
  });

// ── GET ────────────────────────────────────────────────────────

export const GET = withAuth(async (_req, { user }) => {
  const orders = await prisma.rgbOrder.findMany({
    where: user.role === "SUPER_ADMIN" ? {} : { /* org-scoped if needed later */ },
    orderBy: { effectiveFrom: "desc" },
  });
  return NextResponse.json(orders.map(normalizeOrder));
}, "edit");

// ── POST ───────────────────────────────────────────────────────

export const POST = withAuth(async (req, { user }) => {
  const data = await parseBody(req, createSchema);

  const from = new Date(data.effectiveFrom);
  const to = new Date(data.effectiveTo);

  // Check overlapping date ranges
  const overlap = await prisma.rgbOrder.findFirst({
    where: {
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

  const order = await prisma.rgbOrder.create({
    data: {
      orderNumber: data.orderNumber,
      effectiveFrom: from,
      effectiveTo: to,
      oneYearPct: data.oneYearPct,
      twoYearPct: data.twoYearPct,
      twoYearY1Pct: data.twoYearY1Pct ?? null,
      twoYearY2Pct: data.twoYearY2Pct ?? null,
      notes: data.notes ?? null,
    },
  });

  return NextResponse.json(normalizeOrder(order), { status: 201 });
}, "edit");
