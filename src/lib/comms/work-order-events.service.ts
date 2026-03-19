import { getOrCreateEntityThread } from "./conversation.service";
import { postSystemEvent } from "./message.service";

interface WorkOrderEventContext {
  orgId: string;
  workOrderId: string;
  buildingId: string | null;
}

async function getWorkOrderThread(ctx: WorkOrderEventContext) {
  return getOrCreateEntityThread(
    ctx.orgId,
    "system",
    "work_order",
    ctx.workOrderId,
    "Work Order Thread",
    ctx.buildingId
  );
}

export async function emitWorkOrderCreated(
  ctx: WorkOrderEventContext,
  details: { title: string; priority?: string }
) {
  const convo = await getWorkOrderThread(ctx);
  await postSystemEvent({
    conversationId: convo.id,
    body: `Work order created: "${details.title}"${details.priority ? ` · Priority: ${details.priority}` : ""}`,
    metadata: { event: "created", workOrderId: ctx.workOrderId },
  });
}

export async function emitWorkOrderAssigned(
  ctx: WorkOrderEventContext,
  details: { assignedToName: string }
) {
  const convo = await getWorkOrderThread(ctx);
  await postSystemEvent({
    conversationId: convo.id,
    body: `Assigned to ${details.assignedToName}`,
    metadata: { event: "assigned", ...details },
  });
}

export async function emitWorkOrderStatusChanged(
  ctx: WorkOrderEventContext,
  details: { from: string; to: string; changedByName?: string }
) {
  const convo = await getWorkOrderThread(ctx);
  await postSystemEvent({
    conversationId: convo.id,
    body: `Status changed: ${details.from} → ${details.to}${details.changedByName ? ` · by ${details.changedByName}` : ""}`,
    metadata: { event: "status_changed", ...details },
  });
}

export async function emitWorkOrderPriorityChanged(
  ctx: WorkOrderEventContext,
  details: { from: string; to: string }
) {
  const convo = await getWorkOrderThread(ctx);
  await postSystemEvent({
    conversationId: convo.id,
    body: `Priority changed: ${details.from} → ${details.to}`,
    metadata: { event: "priority_changed", ...details },
  });
}

export async function emitWorkOrderCompleted(
  ctx: WorkOrderEventContext,
  details: { completedByName?: string }
) {
  const convo = await getWorkOrderThread(ctx);
  await postSystemEvent({
    conversationId: convo.id,
    body: `Marked complete${details.completedByName ? ` by ${details.completedByName}` : ""}`,
    metadata: { event: "completed", ...details },
  });
}

export async function emitVendorAssigned(
  ctx: WorkOrderEventContext,
  details: { vendorName: string }
) {
  const convo = await getWorkOrderThread(ctx);
  await postSystemEvent({
    conversationId: convo.id,
    body: `Vendor assigned: ${details.vendorName}`,
    metadata: { event: "vendor_assigned", ...details },
  });
}
