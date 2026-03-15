import { prisma } from "@/lib/prisma";

const ALERT_THRESHOLDS = [10, 5, 2, 0]; // days before deadline (0 = overdue check)

/**
 * Checks violations with upcoming certifyByDate deadlines and creates
 * ActivityEvent alerts for 10-day, 5-day, 2-day, and overdue thresholds.
 */
export async function checkCertificationDeadlines(): Promise<{ alertsCreated: number }> {
  const now = new Date();
  const tenDaysOut = new Date();
  tenDaysOut.setDate(tenDaysOut.getDate() + 10);

  // Violations with certifyByDate within 10 days or overdue (include building org for scoping)
  const violations = await prisma.violation.findMany({
    where: {
      certifyByDate: { lte: tenDaysOut },
      isOpen: true,
      lifecycleStatus: { notIn: ["CERTIFIED", "REJECTED"] },
    },
    select: {
      id: true,
      externalId: true,
      buildingId: true,
      certifyByDate: true,
      building: { select: { organizationId: true } },
    },
  });

  let alertsCreated = 0;

  // Wrap writes in a transaction
  await prisma.$transaction(async (tx) => {
    for (const v of violations) {
      if (!v.certifyByDate) continue;

      const daysRemaining = Math.ceil((v.certifyByDate.getTime() - now.getTime()) / 86400000);

      // Only alert at specific thresholds
      const matchedThreshold = ALERT_THRESHOLDS.find((t) =>
        daysRemaining <= t && daysRemaining > t - 1,
      );
      // Also alert if overdue (daysRemaining < 0)
      const isOverdue = daysRemaining < 0;

      if (matchedThreshold === undefined && !isOverdue) continue;

      // Check if we already created this alert today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const existing = await tx.activityEvent.findFirst({
        where: {
          eventType: "certification_deadline_alert",
          relatedRecordId: v.id,
          createdAt: { gte: todayStart },
        },
      });
      if (existing) continue;

      await tx.activityEvent.create({
        data: {
          eventType: "certification_deadline_alert",
          title: isOverdue
            ? `Certification OVERDUE: ${v.externalId}`
            : `Certification deadline in ${daysRemaining} day(s): ${v.externalId}`,
          description: isOverdue
            ? `Violation ${v.externalId} certification is ${Math.abs(daysRemaining)} day(s) overdue.`
            : `Violation ${v.externalId} certification due in ${daysRemaining} day(s).`,
          buildingId: v.buildingId,
          organizationId: v.building?.organizationId ?? null,
          relatedRecordType: "Violation",
          relatedRecordId: v.id,
          metadata: {
            daysRemaining,
            violationId: v.id,
            externalId: v.externalId,
            buildingId: v.buildingId,
            isOverdue,
          },
        },
      });
      alertsCreated++;
    }
  }, { timeout: 120_000 });

  return { alertsCreated };
}
