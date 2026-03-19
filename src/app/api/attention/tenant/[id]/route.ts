import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { computeTenantAttention } from "@/lib/attention/score";
import { canAccessBuilding } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { unit: { select: { buildingId: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, tenant.unit.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const score = await computeTenantAttention(id, user.organizationId!);
  return NextResponse.json(score);
}, "collections");
