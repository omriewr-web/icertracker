import { NextRequest, NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { canAccessBuilding } from "@/lib/data-scope";
import { logAction, getOrCreateStage } from "@/lib/collections/collectionsStageService";
import { z } from "zod";

const actionSchema = z.object({
  actionType: z.string().min(1),
  actionDate: z.string().transform((s) => new Date(s)),
  outcome: z.string().min(1),
  notes: z.string().optional(),
  promisedPaymentDate: z.string().transform((s) => new Date(s)).optional(),
  promisedPaymentAmount: z.number().positive().optional(),
});

export const POST = withAuth(async (req, { user, params }) => {
  if (user.role === "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!user.organizationId) return NextResponse.json({ error: "Organization not configured" }, { status: 401 });

  const { tenantId } = await params;
  const body = await parseBody(req, actionSchema);

  // Verify access
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, unit: { select: { buildingId: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, tenant.unit.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Ensure stage exists
  const stage = await getOrCreateStage(tenantId, user.organizationId);

  const action = await logAction(
    {
      tenantId,
      stageId: stage.id,
      actionType: body.actionType,
      actionDate: body.actionDate,
      outcome: body.outcome,
      notes: body.notes,
      promisedPaymentDate: body.promisedPaymentDate,
      promisedPaymentAmount: body.promisedPaymentAmount,
    },
    user.id,
    user.organizationId
  );

  return NextResponse.json({
    ...action,
    promisedPaymentAmount: action.promisedPaymentAmount ? Number(action.promisedPaymentAmount) : null,
  });
}, "collections");
