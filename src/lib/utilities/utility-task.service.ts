import { prisma } from "@/lib/prisma";

export interface CreateTaskParams {
  orgId: string;
  buildingId: string;
  unitId?: string;
  utilityMeterId?: string;
  utilityAccountId?: string;
  tenantId?: string;
  taskType: string;
  title: string;
  description?: string;
  dueAt?: Date;
  assignedToUserId?: string;
  tenantNameSnapshot?: string;
  unitSnapshot?: string;
  providerSnapshot?: string;
  triggeredBy?: string;
  triggerEventId?: string;
}

export async function createUtilityTask(params: CreateTaskParams) {
  return prisma.utilityTask.create({
    data: {
      orgId: params.orgId,
      buildingId: params.buildingId,
      unitId: params.unitId,
      utilityMeterId: params.utilityMeterId,
      utilityAccountId: params.utilityAccountId,
      tenantId: params.tenantId,
      taskType: params.taskType as any,
      title: params.title,
      description: params.description,
      dueAt: params.dueAt,
      assignedToUserId: params.assignedToUserId,
      tenantNameSnapshot: params.tenantNameSnapshot,
      unitSnapshot: params.unitSnapshot,
      providerSnapshot: params.providerSnapshot,
      triggeredBy: params.triggeredBy,
      triggerEventId: params.triggerEventId,
    },
  });
}

export async function createUtilityTasksBatch(tasks: CreateTaskParams[]) {
  return prisma.$transaction(
    tasks.map((t) =>
      prisma.utilityTask.create({
        data: {
          orgId: t.orgId,
          buildingId: t.buildingId,
          unitId: t.unitId,
          utilityMeterId: t.utilityMeterId,
          utilityAccountId: t.utilityAccountId,
          tenantId: t.tenantId,
          taskType: t.taskType as any,
          title: t.title,
          description: t.description,
          dueAt: t.dueAt,
          assignedToUserId: t.assignedToUserId,
          tenantNameSnapshot: t.tenantNameSnapshot,
          unitSnapshot: t.unitSnapshot,
          providerSnapshot: t.providerSnapshot,
          triggeredBy: t.triggeredBy,
          triggerEventId: t.triggerEventId,
        },
      })
    )
  );
}

export async function completeUtilityTask(
  taskId: string,
  orgId: string,
  userId: string,
  opts?: { notes?: string; proofFileUrl?: string }
) {
  return prisma.utilityTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      completedAt: new Date(),
      completedByUserId: userId,
      ...(opts?.notes !== undefined && { notes: opts.notes }),
      ...(opts?.proofFileUrl !== undefined && { proofFileUrl: opts.proofFileUrl }),
    },
  });
}

export async function getUnitUtilityTasks(orgId: string, unitId: string, status?: string) {
  return prisma.utilityTask.findMany({
    where: {
      orgId,
      unitId,
      ...(status && { status: status as any }),
    },
    orderBy: { dueAt: "asc" },
  });
}

export async function getOverdueUtilityTasks(orgId: string) {
  return prisma.utilityTask.findMany({
    where: {
      orgId,
      status: { in: ["pending", "in_progress"] },
      dueAt: { lt: new Date() },
    },
    orderBy: { dueAt: "asc" },
    take: 100,
  });
}

export async function getPendingTasksByType(orgId: string, taskType: string) {
  return prisma.utilityTask.findMany({
    where: {
      orgId,
      taskType: taskType as any,
      status: "pending",
    },
    orderBy: { dueAt: "asc" },
  });
}

export async function getUtilityTaskDashboardCounts(orgId: string) {
  const now = new Date();
  const [pending, overdue, transferNeeded, ownerHoldNeeded, tenantConfirmNeeded] = await Promise.all([
    prisma.utilityTask.count({ where: { orgId, status: { in: ["pending", "in_progress"] } } }),
    prisma.utilityTask.count({ where: { orgId, status: { in: ["pending", "in_progress"] }, dueAt: { lt: now } } }),
    prisma.utilityTask.count({ where: { orgId, status: { in: ["pending", "in_progress"] }, taskType: "transfer_needed" } }),
    prisma.utilityTask.count({ where: { orgId, status: { in: ["pending", "in_progress"] }, taskType: "confirm_owner_utility" } }),
    prisma.utilityTask.count({ where: { orgId, status: { in: ["pending", "in_progress"] }, taskType: "confirm_tenant_confirmed" } }),
  ]);
  return { pending, overdue, transferNeeded, ownerHoldNeeded, tenantConfirmNeeded };
}
