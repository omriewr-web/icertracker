import { prisma } from "@/lib/prisma";

/**
 * Refreshes collection stage statuses for an organization.
 *
 * 1. Creates CollectionStage for tenants with balance > 0 and no existing stage.
 * 2. Updates daysPastDue from firstDelinquencyDate.
 * 3. Marks actionOverdue where actionDueBy < now AND lastActionAt < actionDueBy.
 */
export async function refreshStageStatuses(orgId: string) {
  const now = new Date();
  let created = 0;
  let updated = 0;
  let overdueMarked = 0;

  // Step 1: Find tenants with balance > 0 and no CollectionStage
  const tenantsWithoutStage = await prisma.tenant.findMany({
    where: {
      isDeleted: false,
      balance: { gt: 0 },
      collectionStage: null,
      unit: {
        building: { organizationId: orgId },
      },
    },
    select: { id: true },
  });

  if (tenantsWithoutStage.length > 0) {
    // Batch create stages
    await prisma.collectionStage.createMany({
      data: tenantsWithoutStage.map((t) => ({
        tenantId: t.id,
        orgId,
        stage: 1,
        stageEnteredAt: now,
        daysPastDue: 0,
        status: "active",
      })),
      skipDuplicates: true,
    });
    created = tenantsWithoutStage.length;
  }

  // Step 2: Update daysPastDue from firstDelinquencyDate for all active stages
  const activeStages = await prisma.collectionStage.findMany({
    where: { orgId, status: "active" },
    select: {
      id: true,
      tenantId: true,
      actionDueBy: true,
      lastActionAt: true,
    },
  });

  if (activeStages.length > 0) {
    const tenantIds = activeStages.map((s) => s.tenantId);
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, firstDelinquencyDate: true, arrearsDays: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    for (const stage of activeStages) {
      const tenant = tenantMap.get(stage.tenantId);
      if (!tenant) continue;

      let daysPastDue = tenant.arrearsDays;
      if (tenant.firstDelinquencyDate) {
        daysPastDue = Math.max(
          0,
          Math.round(
            (now.getTime() - new Date(tenant.firstDelinquencyDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
      }

      await prisma.collectionStage.update({
        where: { id: stage.id },
        data: { daysPastDue },
      });
      updated++;
    }

    // Step 3: Mark actionOverdue
    for (const stage of activeStages) {
      if (!stage.actionDueBy) continue;
      if (new Date(stage.actionDueBy) >= now) continue;

      // lastActionAt must be before actionDueBy (no action taken within window)
      const lastAction = stage.lastActionAt
        ? new Date(stage.lastActionAt)
        : null;
      if (lastAction && lastAction >= new Date(stage.actionDueBy)) continue;

      await prisma.collectionStage.update({
        where: { id: stage.id },
        data: { actionOverdue: true },
      });
      overdueMarked++;
    }
  }

  return { created, updated, overdueMarked };
}
