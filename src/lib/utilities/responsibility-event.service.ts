import { prisma } from "@/lib/prisma";

interface BaseEventParams {
  orgId: string;
  buildingId: string;
  utilityMeterId: string;
  unitId?: string;
  utilityAccountId?: string;
  triggeredBy?: string;
  triggeredByUserId?: string;
  notes?: string;
}

export async function recordAccountOpened(params: BaseEventParams & {
  toPartyType: string;
  toPartyName?: string;
  toTenantId?: string;
  accountNumber?: string;
  providerName?: string;
  leaseStartSnapshot?: Date;
  leaseEndSnapshot?: Date;
  moveInSnapshot?: Date;
  workflowState?: string;
}) {
  return prisma.utilityResponsibilityEvent.create({
    data: {
      orgId: params.orgId,
      buildingId: params.buildingId,
      utilityMeterId: params.utilityMeterId,
      unitId: params.unitId,
      utilityAccountId: params.utilityAccountId,
      eventType: "account_opened",
      workflowState: (params.workflowState ?? "active_confirmed") as any,
      toPartyType: params.toPartyType,
      toPartyName: params.toPartyName,
      toTenantId: params.toTenantId,
      accountNumber: params.accountNumber,
      providerName: params.providerName,
      leaseStartSnapshot: params.leaseStartSnapshot,
      leaseEndSnapshot: params.leaseEndSnapshot,
      moveInSnapshot: params.moveInSnapshot,
      triggeredBy: params.triggeredBy ?? "manual",
      triggeredByUserId: params.triggeredByUserId,
      notes: params.notes,
    },
  });
}

export async function recordAccountClosed(params: BaseEventParams & {
  fromPartyType: string;
  fromPartyName?: string;
  fromTenantId?: string;
  accountNumber?: string;
  providerName?: string;
  workflowState?: string;
}) {
  return prisma.utilityResponsibilityEvent.create({
    data: {
      orgId: params.orgId,
      buildingId: params.buildingId,
      utilityMeterId: params.utilityMeterId,
      unitId: params.unitId,
      utilityAccountId: params.utilityAccountId,
      eventType: "account_closed",
      workflowState: (params.workflowState ?? "closed_clean") as any,
      fromPartyType: params.fromPartyType,
      fromPartyName: params.fromPartyName,
      fromTenantId: params.fromTenantId,
      accountNumber: params.accountNumber,
      providerName: params.providerName,
      triggeredBy: params.triggeredBy ?? "manual",
      triggeredByUserId: params.triggeredByUserId,
      notes: params.notes,
    },
  });
}

export async function recordResponsibilityTransferred(params: BaseEventParams & {
  fromPartyType: string;
  fromPartyName?: string;
  fromTenantId?: string;
  toPartyType: string;
  toPartyName?: string;
  toTenantId?: string;
  workflowState?: string;
}) {
  return prisma.utilityResponsibilityEvent.create({
    data: {
      orgId: params.orgId,
      buildingId: params.buildingId,
      utilityMeterId: params.utilityMeterId,
      unitId: params.unitId,
      utilityAccountId: params.utilityAccountId,
      eventType: "responsibility_transferred",
      workflowState: (params.workflowState ?? "active_confirmed") as any,
      fromPartyType: params.fromPartyType,
      fromPartyName: params.fromPartyName,
      fromTenantId: params.fromTenantId,
      toPartyType: params.toPartyType,
      toPartyName: params.toPartyName,
      toTenantId: params.toTenantId,
      triggeredBy: params.triggeredBy,
      triggeredByUserId: params.triggeredByUserId,
      notes: params.notes,
    },
  });
}

export async function recordOwnerHoldStarted(params: BaseEventParams & {
  fromTenantId?: string;
  fromPartyName?: string;
}) {
  return prisma.utilityResponsibilityEvent.create({
    data: {
      orgId: params.orgId,
      buildingId: params.buildingId,
      utilityMeterId: params.utilityMeterId,
      unitId: params.unitId,
      utilityAccountId: params.utilityAccountId,
      eventType: "owner_hold_started",
      workflowState: "owner_hold",
      fromPartyType: "tenant",
      fromPartyName: params.fromPartyName,
      fromTenantId: params.fromTenantId,
      toPartyType: "owner",
      triggeredBy: params.triggeredBy ?? "vacancy",
      triggeredByUserId: params.triggeredByUserId,
      notes: params.notes,
    },
  });
}

export async function recordMoveOut(params: BaseEventParams & {
  tenantId?: string;
  tenantName?: string;
  moveOutDate?: Date;
  leaseStartSnapshot?: Date;
  leaseEndSnapshot?: Date;
}) {
  return prisma.utilityResponsibilityEvent.create({
    data: {
      orgId: params.orgId,
      buildingId: params.buildingId,
      utilityMeterId: params.utilityMeterId,
      unitId: params.unitId,
      utilityAccountId: params.utilityAccountId,
      eventType: "move_out_recorded",
      workflowState: "old_tenant_close_pending",
      fromPartyType: "tenant",
      fromPartyName: params.tenantName,
      fromTenantId: params.tenantId,
      moveOutSnapshot: params.moveOutDate,
      leaseStartSnapshot: params.leaseStartSnapshot,
      leaseEndSnapshot: params.leaseEndSnapshot,
      triggeredBy: params.triggeredBy ?? "move_out",
      triggeredByUserId: params.triggeredByUserId,
      notes: params.notes,
    },
  });
}

export async function recordMoveIn(params: BaseEventParams & {
  tenantId?: string;
  tenantName?: string;
  moveInDate?: Date;
  leaseStartSnapshot?: Date;
  leaseEndSnapshot?: Date;
}) {
  return prisma.utilityResponsibilityEvent.create({
    data: {
      orgId: params.orgId,
      buildingId: params.buildingId,
      utilityMeterId: params.utilityMeterId,
      unitId: params.unitId,
      utilityAccountId: params.utilityAccountId,
      eventType: "move_in_recorded",
      workflowState: "tenant_to_open",
      toPartyType: "tenant",
      toPartyName: params.tenantName,
      toTenantId: params.tenantId,
      moveInSnapshot: params.moveInDate,
      leaseStartSnapshot: params.leaseStartSnapshot,
      leaseEndSnapshot: params.leaseEndSnapshot,
      triggeredBy: params.triggeredBy ?? "lease_created",
      triggeredByUserId: params.triggeredByUserId,
      notes: params.notes,
    },
  });
}

export async function getMeterEventHistory(orgId: string, utilityMeterId: string) {
  return prisma.utilityResponsibilityEvent.findMany({
    where: { orgId, utilityMeterId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getUnitUtilityHistory(orgId: string, unitId: string) {
  return prisma.utilityResponsibilityEvent.findMany({
    where: { orgId, unitId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
