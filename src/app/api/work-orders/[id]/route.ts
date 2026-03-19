import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { workOrderUpdateSchema } from "@/lib/validations";
import { assertBuildingAccess, assertWorkOrderAccess } from "@/lib/data-scope";
import { getDisplayAddress } from "@/lib/building-matching";
import { toNumber } from "@/lib/utils/decimal";
import { validateWorkOrderRelations } from "@/lib/work-order-relations";
import {
  emitWorkOrderStatusChanged,
  emitWorkOrderPriorityChanged,
  emitWorkOrderCompleted,
  emitWorkOrderAssigned,
  emitVendorAssigned,
} from "@/lib/comms/work-order-events.service";

export const dynamic = "force-dynamic";

const include = {
  building: { select: { address: true, altAddress: true } },
  unit: { select: { unitNumber: true } },
  tenant: { select: { name: true } },
  vendor: { select: { name: true } },
  assignedTo: { select: { name: true } },
  createdBy: { select: { name: true } },
  comments: {
    orderBy: { createdAt: "desc" as const },
    include: { author: { select: { name: true } } },
  },
  _count: { select: { comments: true } },
};

function mapWorkOrder(wo: any) {
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
    trade: wo.trade ?? null,
    violationId: wo.violationId ?? null,
    comments: wo.comments?.map((c: any) => ({
      id: c.id,
      text: c.text,
      photos: c.photos ?? null,
      author: c.author,
      createdAt: c.createdAt?.toISOString(),
    })) ?? [],
  };
}

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertWorkOrderAccess(user, id);
  if (denied) return denied;

  const wo = await prisma.workOrder.findUnique({ where: { id }, include });
  if (!wo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(mapWorkOrder(wo));
}, "maintenance");

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertWorkOrderAccess(user, id);
  if (denied) return denied;
  const data = await parseBody(req, workOrderUpdateSchema);

  // Fetch current state for activity logging
  const current = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      buildingId: true,
      unitId: true,
      tenantId: true,
      status: true,
      priority: true,
      vendorId: true,
      assignedToId: true,
      dueDate: true,
    },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const targetBuildingId = data.buildingId ?? current.buildingId;
  if (targetBuildingId !== current.buildingId) {
    const targetDenied = await assertBuildingAccess(user, targetBuildingId);
    if (targetDenied) return targetDenied;
  }

  await validateWorkOrderRelations({
    buildingId: targetBuildingId,
    unitId: data.unitId !== undefined ? data.unitId : current.unitId,
    tenantId: data.tenantId !== undefined ? data.tenantId : current.tenantId,
    vendorId: data.vendorId !== undefined ? data.vendorId : current.vendorId,
    assignedToId: data.assignedToId !== undefined ? data.assignedToId : current.assignedToId,
  });

  const updateData: any = { ...data };
  if (data.scheduledDate !== undefined) {
    updateData.scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : null;
  }
  if (data.completedDate !== undefined) {
    updateData.completedDate = data.completedDate ? new Date(data.completedDate) : null;
  }
  if (data.dueDate !== undefined) {
    updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  }
  if (data.status === "COMPLETED" && !data.completedDate) {
    updateData.completedDate = new Date();
  }

  // Build activity log entries
  const activities: { workOrderId: string; userId: string; action: string; fromValue: string | null; toValue: string | null }[] = [];

  if (data.status !== undefined && data.status !== current.status) {
    activities.push({ workOrderId: id, userId: user.id, action: "status_changed", fromValue: current.status, toValue: data.status });
  }
  if (data.priority !== undefined && data.priority !== current.priority) {
    activities.push({ workOrderId: id, userId: user.id, action: "priority_changed", fromValue: current.priority, toValue: data.priority });
  }
  if (data.vendorId !== undefined && data.vendorId !== current.vendorId) {
    activities.push({ workOrderId: id, userId: user.id, action: "vendor_assigned", fromValue: current.vendorId, toValue: data.vendorId || null });
  }
  if (data.assignedToId !== undefined && data.assignedToId !== current.assignedToId) {
    activities.push({ workOrderId: id, userId: user.id, action: "user_assigned", fromValue: current.assignedToId, toValue: data.assignedToId || null });
  }
  if (data.dueDate !== undefined) {
    const oldDue = current.dueDate?.toISOString().split("T")[0] ?? null;
    const newDue = data.dueDate ? data.dueDate.split("T")[0] : null;
    if (oldDue !== newDue) {
      activities.push({ workOrderId: id, userId: user.id, action: "due_date_set", fromValue: oldDue, toValue: newDue });
    }
  }
  if (data.status === "COMPLETED" && current.status !== "COMPLETED") {
    activities.push({ workOrderId: id, userId: user.id, action: "completed", fromValue: null, toValue: new Date().toISOString() });
  }

  // Use transaction to update work order and log activities
  const wo = await prisma.$transaction(async (tx) => {
    const updated = await tx.workOrder.update({ where: { id }, data: updateData, include });
    if (activities.length > 0) {
      await tx.workOrderActivity.createMany({ data: activities });
    }
    return updated;
  });

  // Fire-and-forget comms events — never block the main response
  const evtCtx = { orgId: user.organizationId!, workOrderId: id, buildingId: current.buildingId };
  try {
    if (data.status !== undefined && data.status !== current.status) {
      await emitWorkOrderStatusChanged(evtCtx, { from: current.status, to: data.status, changedByName: user.name });
    }
    if (data.priority !== undefined && data.priority !== current.priority) {
      await emitWorkOrderPriorityChanged(evtCtx, { from: current.priority, to: data.priority });
    }
    if (data.status === "COMPLETED" && current.status !== "COMPLETED") {
      await emitWorkOrderCompleted(evtCtx, { completedByName: user.name });
    }
    if (data.assignedToId !== undefined && data.assignedToId !== current.assignedToId && data.assignedToId) {
      await emitWorkOrderAssigned(evtCtx, { assignedToName: wo.assignedTo?.name ?? data.assignedToId });
    }
    if (data.vendorId !== undefined && data.vendorId !== current.vendorId && data.vendorId) {
      await emitVendorAssigned(evtCtx, { vendorName: wo.vendor?.name ?? data.vendorId });
    }
  } catch (e) {
    // Non-blocking — do not fail the main request
  }

  return NextResponse.json(mapWorkOrder(wo));
}, "maintenance");

export const DELETE = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertWorkOrderAccess(user, id);
  if (denied) return denied;

  await prisma.workOrder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}, "maintenance");
