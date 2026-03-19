import { NextRequest, NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { canAccessBuilding } from "@/lib/data-scope";
import { advanceStage } from "@/lib/collections/collectionsStageService";
import { z } from "zod";

const advanceSchema = z.object({
  newStage: z.number().int().min(1).max(6),
});

export const POST = withAuth(async (req, { user, params }) => {
  // Require manager or admin role
  const managerRoles = ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN", "PM"];
  if (!managerRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden — manager or admin role required" }, { status: 403 });
  }
  if (!user.organizationId) return NextResponse.json({ error: "Organization not configured" }, { status: 401 });

  const { tenantId } = await params;
  const body = await parseBody(req, advanceSchema);

  // Verify access
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, unit: { select: { buildingId: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, tenant.unit.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stage = await advanceStage(tenantId, user.organizationId, body.newStage);
  return NextResponse.json(stage);
}, "collections");
