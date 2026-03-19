import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { canAccessBuilding } from "@/lib/data-scope";
import { getOrCreateStage, getDecisionRecommendation } from "@/lib/collections/collectionsStageService";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  if (user.role === "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!user.organizationId) return NextResponse.json({ error: "Organization not configured" }, { status: 401 });

  const { tenantId } = await params;

  // Verify access
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, unit: { select: { buildingId: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, tenant.unit.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stage = await getOrCreateStage(tenantId, user.organizationId);

  const actions = await prisma.collectionAction.findMany({
    where: { tenantId, orgId: user.organizationId },
    orderBy: { actionDate: "desc" },
    take: 10,
    include: {
      staff: { select: { id: true, name: true } },
    },
  });

  const recommendation = await getDecisionRecommendation(tenantId, user.organizationId);

  // Serialize Decimal fields
  const serializedActions = actions.map((a) => ({
    ...a,
    promisedPaymentAmount: a.promisedPaymentAmount ? Number(a.promisedPaymentAmount) : null,
  }));

  return NextResponse.json({
    stage,
    actions: serializedActions,
    recommendation,
  });
}, "collections");
