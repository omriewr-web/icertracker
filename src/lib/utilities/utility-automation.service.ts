import { prisma } from "@/lib/prisma";
import { recordMoveOut, recordOwnerHoldStarted, recordMoveIn } from "./responsibility-event.service";
import { createUtilityTasksBatch, type CreateTaskParams } from "./utility-task.service";

/**
 * Utility automation hooks — fire-and-forget from caller's perspective.
 * All functions catch errors internally and never throw.
 */

export async function onMoveOutRecorded(params: {
  orgId: string;
  buildingId: string;
  unitId: string;
  tenantId: string;
  tenantName: string;
  moveOutDate: Date;
  leaseStart?: Date;
  leaseEnd?: Date;
  triggeredByUserId?: string;
}) {
  try {
    // Find all active unit_submeter meters for this unit
    const meters = await prisma.utilityMeter.findMany({
      where: { unitId: params.unitId, isActive: true, classification: "unit_submeter" },
      include: { accounts: { where: { status: "active" } } },
    });

    const tasks: CreateTaskParams[] = [];
    for (const meter of meters) {
      const activeAccount = meter.accounts[0];
      if (!activeAccount) continue;

      // Record move out event
      try {
        await recordMoveOut({
          orgId: params.orgId,
          buildingId: params.buildingId,
          utilityMeterId: meter.id,
          unitId: params.unitId,
          utilityAccountId: activeAccount.id,
          tenantId: params.tenantId,
          tenantName: params.tenantName,
          moveOutDate: params.moveOutDate,
          leaseStartSnapshot: params.leaseStart,
          leaseEndSnapshot: params.leaseEnd,
          triggeredBy: "move_out",
          triggeredByUserId: params.triggeredByUserId,
        });
      } catch (e) {
        console.error("Failed to record move-out event:", e);
      }

      const base: Omit<CreateTaskParams, "taskType" | "title" | "dueAt"> & { description?: string } = {
        orgId: params.orgId,
        buildingId: params.buildingId,
        unitId: params.unitId,
        utilityMeterId: meter.id,
        utilityAccountId: activeAccount.id,
        tenantId: params.tenantId,
        tenantNameSnapshot: params.tenantName,
        unitSnapshot: undefined,
        providerSnapshot: meter.providerName || undefined,
        triggeredBy: "move_out",
      };

      const moveOut = new Date(params.moveOutDate);
      const d14 = new Date(moveOut);
      d14.setDate(d14.getDate() - 14);
      const d7 = new Date(moveOut);
      d7.setDate(d7.getDate() - 7);

      tasks.push({
        ...base,
        taskType: "tenant_close_account",
        title: `Close ${meter.utilityType} account — ${params.tenantName}`,
        description: `Tenant moving out. Contact provider to close account.`,
        dueAt: d14,
      });
      tasks.push({
        ...base,
        taskType: "tenant_close_account",
        title: `Follow-up: close ${meter.utilityType} account — ${params.tenantName}`,
        description: `Follow up on account closure before move-out.`,
        dueAt: d7,
      });
      tasks.push({
        ...base,
        taskType: "upload_close_proof",
        title: `Upload final bill — ${meter.utilityType}`,
        description: `Upload proof of account closure / final bill.`,
        dueAt: moveOut,
      });
    }

    if (tasks.length > 0) {
      await createUtilityTasksBatch(tasks);
    }
  } catch (e) {
    console.error("Utility automation failed on move-out:", e);
  }
}

export async function onUnitBecameVacant(params: {
  orgId: string;
  buildingId: string;
  unitId: string;
  triggeredByUserId?: string;
}) {
  try {
    const meters = await prisma.utilityMeter.findMany({
      where: { unitId: params.unitId, isActive: true, classification: "unit_submeter" },
      include: { accounts: { where: { status: "active" } } },
    });

    const tasks: CreateTaskParams[] = [];
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 3);

    for (const meter of meters) {
      const activeAccount = meter.accounts[0];

      // Record owner hold started
      try {
        await recordOwnerHoldStarted({
          orgId: params.orgId,
          buildingId: params.buildingId,
          utilityMeterId: meter.id,
          unitId: params.unitId,
          utilityAccountId: activeAccount?.id,
          triggeredBy: "vacancy",
          triggeredByUserId: params.triggeredByUserId,
        });
      } catch (e) {
        console.error("Failed to record owner hold started:", e);
      }

      tasks.push({
        orgId: params.orgId,
        buildingId: params.buildingId,
        unitId: params.unitId,
        utilityMeterId: meter.id,
        utilityAccountId: activeAccount?.id,
        taskType: "confirm_owner_utility",
        title: `Confirm owner utility — ${meter.utilityType}`,
        description: `Unit is vacant. Confirm owner is responsible for ${meter.utilityType}.`,
        dueAt,
        providerSnapshot: meter.providerName || undefined,
        triggeredBy: "vacancy",
      });
    }

    if (tasks.length > 0) {
      await createUtilityTasksBatch(tasks);
    }
  } catch (e) {
    console.error("Utility automation failed on unit became vacant:", e);
  }
}

export async function onNewTenantCreated(params: {
  orgId: string;
  buildingId: string;
  unitId: string;
  tenantId: string;
  tenantName: string;
  moveInDate?: Date;
  leaseEnd?: Date;
  triggeredByUserId?: string;
}) {
  try {
    const meters = await prisma.utilityMeter.findMany({
      where: { unitId: params.unitId, isActive: true, classification: "unit_submeter" },
      include: { accounts: { where: { status: "active" } } },
    });

    const tasks: CreateTaskParams[] = [];
    const moveIn = params.moveInDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const confirmDue = new Date(moveIn);
    confirmDue.setDate(confirmDue.getDate() + 7);

    for (const meter of meters) {
      const activeAccount = meter.accounts[0];

      // Record move in event
      try {
        await recordMoveIn({
          orgId: params.orgId,
          buildingId: params.buildingId,
          utilityMeterId: meter.id,
          unitId: params.unitId,
          utilityAccountId: activeAccount?.id,
          tenantId: params.tenantId,
          tenantName: params.tenantName,
          moveInDate: params.moveInDate,
          leaseEndSnapshot: params.leaseEnd,
          triggeredBy: "lease_created",
          triggeredByUserId: params.triggeredByUserId,
        });
      } catch (e) {
        console.error("Failed to record move-in event:", e);
      }

      tasks.push({
        orgId: params.orgId,
        buildingId: params.buildingId,
        unitId: params.unitId,
        utilityMeterId: meter.id,
        utilityAccountId: activeAccount?.id,
        tenantId: params.tenantId,
        tenantNameSnapshot: params.tenantName,
        providerSnapshot: meter.providerName || undefined,
        taskType: "tenant_open_account",
        title: `Open ${meter.utilityType} account — ${params.tenantName}`,
        description: `New tenant moving in. Open utility account with provider.`,
        dueAt: moveIn,
        triggeredBy: "lease_created",
      });
      tasks.push({
        orgId: params.orgId,
        buildingId: params.buildingId,
        unitId: params.unitId,
        utilityMeterId: meter.id,
        utilityAccountId: activeAccount?.id,
        tenantId: params.tenantId,
        tenantNameSnapshot: params.tenantName,
        providerSnapshot: meter.providerName || undefined,
        taskType: "confirm_tenant_confirmed",
        title: `Confirm ${meter.utilityType} account opened — ${params.tenantName}`,
        description: `Confirm tenant has opened utility account with provider.`,
        dueAt: confirmDue,
        triggeredBy: "lease_created",
      });
    }

    if (tasks.length > 0) {
      await createUtilityTasksBatch(tasks);
    }
  } catch (e) {
    console.error("Utility automation failed on new tenant:", e);
  }
}

export async function onVacancyClosed(params: {
  orgId: string;
  unitId: string;
}) {
  try {
    await prisma.utilityTask.updateMany({
      where: {
        orgId: params.orgId,
        unitId: params.unitId,
        taskType: "confirm_owner_utility",
        status: { in: ["pending", "in_progress"] },
      },
      data: {
        status: "completed",
        completedAt: new Date(),
        notes: "Auto-resolved: vacancy closed.",
      },
    });
  } catch (e) {
    console.error("Utility automation failed on vacancy closed:", e);
  }
}
