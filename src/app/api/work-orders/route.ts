import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { workOrderCreateSchema } from "@/lib/validations";
import { getBuildingScope, EMPTY_SCOPE, assertBuildingAccess } from "@/lib/data-scope";
import { getDisplayAddress } from "@/lib/building-matching";
import { WorkOrderView } from "@/types";
import { toNumber } from "@/lib/utils/decimal";
import { validateWorkOrderRelations } from "@/lib/work-order-relations";
import { WorkOrderStatus, WorkOrderPriority, WorkOrderCategory } from "@prisma/client";
import { captureBusinessMessage, captureSentryException } from "@/lib/sentry-observability";

export const dynamic = "force-dynamic";

function mapWorkOrder(wo: any): WorkOrderView {
  return {
    id: wo.id,
    title: wo.title,
    description: wo.description,
    status: wo.status,
    priority: wo.priority,
    category: wo.category,
    photos: wo.photos as string[] | null,
    estimatedCost: wo.estimatedCost ? toNumber(wo.estimatedCost) : null,
    actualCost: wo.actualCost ? toNumber(wo.actualCost) : null,
    scheduledDate: wo.scheduledDate?.toISOString() ?? null,
    completedDate: wo.completedDate?.toISOString() ?? null,
    buildingId: wo.buildingId,
    buildingAddress: wo.building ? getDisplayAddress(wo.building) : "",
    unitId: wo.unitId,
    unitNumber: wo.unit?.unitNumber ?? null,
    tenantId: wo.tenantId,
    tenantName: wo.tenant?.name ?? null,
    vendorId: wo.vendorId,
    vendorName: wo.vendor?.name ?? null,
    assignedToId: wo.assignedToId,
    assignedToName: wo.assignedTo?.name ?? null,
    createdById: wo.createdById,
    createdByName: wo.createdBy?.name ?? null,
    commentCount: wo._count?.comments ?? 0,
    createdAt: wo.createdAt?.toISOString(),
    updatedAt: wo.updatedAt?.toISOString(),
    dueDate: wo.dueDate?.toISOString() ?? null,
    sourceType: wo.sourceType ?? null,
    sourceId: wo.sourceId ?? null,
  };
}

const include = {
  building: { select: { address: true, altAddress: true } },
  unit: { select: { unitNumber: true } },
  tenant: { select: { name: true } },
  vendor: { select: { name: true } },
  assignedTo: { select: { name: true } },
  createdBy: { select: { name: true } },
  _count: { select: { comments: true } },
};

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const category = url.searchParams.get("category");

  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const where: any = { ...scope };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "200", 10) || 200));

  const orders = await prisma.workOrder.findMany({
    where,
    include,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json(orders.map(mapWorkOrder));
}, "maintenance");

export const POST = withAuth(async (req, { user }) => {
  const data = await parseBody(req, workOrderCreateSchema);

  const forbidden = await assertBuildingAccess(user, data.buildingId);
  if (forbidden) return forbidden;

  await validateWorkOrderRelations({
    buildingId: data.buildingId,
    unitId: data.unitId,
    tenantId: data.tenantId,
    vendorId: data.vendorId,
    assignedToId: data.assignedToId,
  });

  const wo = await prisma.workOrder.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status as WorkOrderStatus,
        priority: data.priority as WorkOrderPriority,
        category: data.category as WorkOrderCategory,
        photos: data.photos ?? undefined,
        estimatedCost: data.estimatedCost,
        actualCost: data.actualCost,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
        completedDate: data.completedDate ? new Date(data.completedDate) : null,
        buildingId: data.buildingId,
        unitId: data.unitId || null,
        tenantId: data.tenantId || null,
        vendorId: data.vendorId || null,
        assignedToId: data.assignedToId || null,
        createdById: user.id,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        sourceType: data.sourceType || null,
        sourceId: data.sourceId || null,
      },
      include,
    }).catch((error) => {
      captureBusinessMessage("Failed work order creation", {
        level: "error",
        tags: {
          buildingId: data.buildingId,
          userId: user.id,
        },
        extra: {
          category: data.category,
          priority: data.priority,
          sourceType: data.sourceType ?? null,
        },
        fingerprint: ["work-order-create-failed", data.buildingId],
      });
      captureSentryException(error, {
        level: "error",
        tags: {
          buildingId: data.buildingId,
          userId: user.id,
        },
      });
      throw error;
    });

  // Fire-and-forget comms event
  try {
    const { emitWorkOrderCreated } = await import("@/lib/comms/work-order-events.service");
    await emitWorkOrderCreated(
      { orgId: user.organizationId!, workOrderId: wo.id, buildingId: wo.buildingId ?? null },
      { title: wo.title, priority: wo.priority }
    );
  } catch (error) {
    captureBusinessMessage("Work order comms event failed", {
      level: "warning",
      tags: {
        workOrderId: wo.id,
        buildingId: wo.buildingId,
        userId: user.id,
      },
      fingerprint: ["work-order-comms-event-failed", wo.id],
    });
    captureSentryException(error, {
      level: "warning",
      tags: {
        workOrderId: wo.id,
        buildingId: wo.buildingId,
        userId: user.id,
      },
    });
  }

  return NextResponse.json(mapWorkOrder(wo), { status: 201 });
}, "maintenance");

