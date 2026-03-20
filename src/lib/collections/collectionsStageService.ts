import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────

export interface CreateActionInput {
  tenantId: string;
  stageId: string;
  actionType: string;
  actionDate: Date;
  outcome: string;
  notes?: string;
  promisedPaymentDate?: Date;
  promisedPaymentAmount?: number;
}

interface ProtocolConfig {
  stage2TriggerDays: number;
  stage3TriggerDays: number;
  stage4TriggerDays: number;
  stage5TriggerDays: number;
  stage2ActionWindowDays: number;
  stage3ActionWindowDays: number;
  stage4ActionWindowDays: number;
}

interface OverdueAlert {
  stageId: string;
  tenantId: string;
  tenantName: string;
  unitNumber: string;
  buildingAddress: string;
  balance: number;
  stage: number;
  daysPastDue: number;
  actionOverdue: boolean;
  promiseBroken: boolean;
  lastActionAt: Date | null;
  actionDueBy: Date | null;
  nextRecommendedAction: string | null;
}

export interface DecisionRecommendation {
  recommendedAction: string;
  reason: string;
  urgency: "low" | "medium" | "high" | "critical";
}

// ── Helpers ───────────────────────────────────────────────────

async function getProtocol(orgId: string): Promise<ProtocolConfig> {
  const protocol = await prisma.collectionProtocol.findUnique({
    where: { orgId },
  });
  return {
    stage2TriggerDays: protocol?.stage2TriggerDays ?? 6,
    stage3TriggerDays: protocol?.stage3TriggerDays ?? 15,
    stage4TriggerDays: protocol?.stage4TriggerDays ?? 31,
    stage5TriggerDays: protocol?.stage5TriggerDays ?? 60,
    stage2ActionWindowDays: protocol?.stage2ActionWindowDays ?? 4,
    stage3ActionWindowDays: protocol?.stage3ActionWindowDays ?? 3,
    stage4ActionWindowDays: protocol?.stage4ActionWindowDays ?? 4,
  };
}

function computeActionDueBy(
  stage: number,
  protocol: ProtocolConfig
): Date | null {
  const windowDaysMap: Record<number, number> = {
    2: protocol.stage2ActionWindowDays,
    3: protocol.stage3ActionWindowDays,
    4: protocol.stage4ActionWindowDays,
  };
  const windowDays = windowDaysMap[stage];
  if (!windowDays) return null;
  const due = new Date();
  due.setDate(due.getDate() + windowDays);
  return due;
}

// ── getOrCreateStage ──────────────────────────────────────────

export async function getOrCreateStage(tenantId: string, orgId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.collectionStage.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;

    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { arrearsDays: true },
    });

    return tx.collectionStage.create({
      data: {
        tenantId,
        orgId,
        stage: 1,
        stageEnteredAt: new Date(),
        daysPastDue: tenant?.arrearsDays ?? 0,
        status: "active",
      },
    });
  });
}

// ── logAction ─────────────────────────────────────────────────

export async function logAction(
  data: CreateActionInput,
  userId: string,
  orgId: string
) {
  return prisma.$transaction(async (tx) => {
    const action = await tx.collectionAction.create({
      data: {
        tenantId: data.tenantId,
        orgId,
        stageId: data.stageId,
        actionType: data.actionType,
        actionDate: data.actionDate,
        outcome: data.outcome,
        notes: data.notes ?? null,
        promisedPaymentDate: data.promisedPaymentDate ?? null,
        promisedPaymentAmount: data.promisedPaymentAmount ?? null,
        staffId: userId,
      },
    });

    await tx.collectionStage.update({
      where: { tenantId: data.tenantId },
      data: {
        lastActionAt: new Date(),
        lastActionType: data.actionType,
        actionOverdue: false,
      },
    });

    return action;
  });
}

// ── advanceStage ──────────────────────────────────────────────

export async function advanceStage(
  tenantId: string,
  orgId: string,
  newStage: number
) {
  const protocol = await getProtocol(orgId);
  const actionDueBy = computeActionDueBy(newStage, protocol);

  return prisma.$transaction(async (tx) => {
    const current = await tx.collectionStage.findUnique({
      where: { tenantId },
      select: { stage: true },
    });

    if (!current) {
      throw new Error("Collection stage not found for this tenant");
    }

    if (newStage <= current.stage) {
      throw new Error(
        `Cannot regress stage from ${current.stage} to ${newStage}. Stage must advance forward.`
      );
    }

    return tx.collectionStage.update({
      where: { tenantId },
      data: {
        stage: newStage,
        stageEnteredAt: new Date(),
        actionDueBy,
        actionOverdue: false,
      },
    });
  });
}

// ── getOverdueAlerts ──────────────────────────────────────────

export async function getOverdueAlerts(
  orgId: string
): Promise<OverdueAlert[]> {
  // Get stages that are overdue or have broken promises
  const stages = await prisma.collectionStage.findMany({
    where: {
      orgId,
      status: "active",
      OR: [{ actionOverdue: true }],
    },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          balance: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { address: true } },
            },
          },
        },
      },
    },
  });

  // Also check for broken promises
  const brokenPromiseStageIds = new Set<string>();
  if (stages.length > 0) {
    const stageIds = stages.map((s) => s.id);
    const brokenActions = await prisma.collectionAction.findMany({
      where: {
        stageId: { in: stageIds },
        promiseBroken: true,
      },
      select: { stageId: true },
      distinct: ["stageId"],
    });
    for (const a of brokenActions) {
      brokenPromiseStageIds.add(a.stageId);
    }
  }

  // Also find stages with broken promises that aren't already overdue
  const brokenPromiseActions = await prisma.collectionAction.findMany({
    where: {
      orgId,
      promiseBroken: true,
    },
    select: { stageId: true },
    distinct: ["stageId"],
  });
  const additionalStageIds = brokenPromiseActions
    .map((a) => a.stageId)
    .filter((id) => !stages.find((s) => s.id === id));

  let additionalStages: typeof stages = [];
  if (additionalStageIds.length > 0) {
    additionalStages = await prisma.collectionStage.findMany({
      where: {
        id: { in: additionalStageIds },
        orgId,
        status: "active",
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            balance: true,
            unit: {
              select: {
                unitNumber: true,
                building: { select: { address: true } },
              },
            },
          },
        },
      },
    });
    for (const s of additionalStages) {
      brokenPromiseStageIds.add(s.id);
    }
  }

  const allStages = [...stages, ...additionalStages];

  return allStages.map((s) => ({
    stageId: s.id,
    tenantId: s.tenant.id,
    tenantName: s.tenant.name,
    unitNumber: s.tenant.unit.unitNumber,
    buildingAddress: s.tenant.unit.building?.address || "",
    balance: Number(s.tenant.balance),
    stage: s.stage,
    daysPastDue: s.daysPastDue,
    actionOverdue: s.actionOverdue,
    promiseBroken: brokenPromiseStageIds.has(s.id),
    lastActionAt: s.lastActionAt,
    actionDueBy: s.actionDueBy,
    nextRecommendedAction: s.nextRecommendedAction,
  }));
}

// ── getDecisionRecommendation ─────────────────────────────────

export async function getDecisionRecommendation(
  tenantId: string,
  orgId: string
): Promise<DecisionRecommendation> {
  const [stage, tenant, recentActions] = await Promise.all([
    prisma.collectionStage.findUnique({ where: { tenantId } }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { balance: true },
    }),
    prisma.collectionAction.findMany({
      where: { tenantId, orgId },
      orderBy: { actionDate: "desc" },
      take: 20,
    }),
  ]);

  if (!stage || !tenant) {
    return {
      recommendedAction: "Create collection stage for this tenant.",
      reason: "No collection stage found.",
      urgency: "low",
    };
  }

  const balance = Number(tenant.balance);
  const now = new Date();

  // Check for broken promises
  const brokenPromise = recentActions.find((a) => a.promiseBroken === true);
  if (brokenPromise && balance > 0) {
    return {
      recommendedAction:
        "Promise broken — escalate immediately. Do not accept another promise without partial payment.",
      reason: `Tenant broke a payment promise. Balance still owed: $${balance.toFixed(2)}.`,
      urgency: "critical",
    };
  }

  // Stage 2: no action in 4 days
  if (stage.stage === 2) {
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const hasRecentAction = recentActions.some(
      (a) => a.actionDate >= fourDaysAgo
    );
    if (!hasRecentAction) {
      return {
        recommendedAction:
          "URGENT: First contact overdue. Call tenant today.",
        reason: "Stage 2 with no action logged in the past 4 days.",
        urgency: "high",
      };
    }
  }

  // Stage 3: no notice logged
  if (stage.stage === 3) {
    const hasNotice = recentActions.some(
      (a) => a.actionType === "notice_14day"
    );
    if (!hasNotice) {
      return {
        recommendedAction:
          "14-day rent demand notice required. Issue today.",
        reason: "Stage 3 requires a 14-day rent demand notice.",
        urgency: "high",
      };
    }

    // Stage 3: notice issued and 14 days elapsed with no payment
    const noticeAction = recentActions.find(
      (a) => a.actionType === "notice_14day"
    );
    if (noticeAction) {
      const fourteenDaysAfterNotice = new Date(noticeAction.actionDate);
      fourteenDaysAfterNotice.setDate(
        fourteenDaysAfterNotice.getDate() + 14
      );
      if (now >= fourteenDaysAfterNotice && balance > 0) {
        return {
          recommendedAction:
            "Advance to Stage 4 — pre-legal review.",
          reason:
            "14-day notice issued and 14 days have elapsed with no payment.",
          urgency: "high",
        };
      }
    }
  }

  // Stage 4: no attorney notification
  if (stage.stage === 4) {
    const hasAttorneyNotice = recentActions.some(
      (a) => a.actionType === "legal_referral"
    );
    if (!hasAttorneyNotice) {
      return {
        recommendedAction:
          "Notify attorney. Case approaching legal threshold.",
        reason: "Stage 4 requires attorney notification.",
        urgency: "high",
      };
    }

    // Stage 4: daysPastDue >= 60
    if (stage.daysPastDue >= 60) {
      return {
        recommendedAction:
          "Legal referral threshold reached. File with Housing Court.",
        reason: `${stage.daysPastDue} days past due — exceeds 60-day legal filing threshold.`,
        urgency: "critical",
      };
    }
  }

  // Payment plan at risk: last payment > 30 days ago
  const paymentPlanAction = recentActions.find(
    (a) => a.outcome === "payment_plan"
  );
  if (paymentPlanAction) {
    const lastPaymentAction = recentActions.find(
      (a) =>
        a.outcome === "payment_received" || a.outcome === "partial_payment"
    );
    if (lastPaymentAction) {
      const daysSincePayment = Math.round(
        (now.getTime() - new Date(lastPaymentAction.actionDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysSincePayment > 30) {
        return {
          recommendedAction:
            "Payment plan at risk. Contact tenant.",
          reason: `Last payment was ${daysSincePayment} days ago on an active payment plan.`,
          urgency: "medium",
        };
      }
    }
  }

  // Balance decreased since last check (positive movement)
  // Compare current balance with the most recent snapshot or action context
  const latestSnapshot = await prisma.balanceSnapshot.findFirst({
    where: { tenantId },
    orderBy: { snapshotDate: "desc" },
    take: 1,
    select: { currentBalance: true },
  });
  if (latestSnapshot && Number(latestSnapshot.currentBalance) > balance) {
    return {
      recommendedAction:
        "Positive movement detected. Confirm payment posted correctly.",
      reason: `Balance decreased from $${Number(latestSnapshot.currentBalance).toFixed(2)} to $${balance.toFixed(2)}.`,
      urgency: "low",
    };
  }

  // No actions logged and stage > 1
  if (recentActions.length === 0 && stage.stage > 1) {
    return {
      recommendedAction:
        "No documented contact for this tenant. Log first action immediately.",
      reason: `Tenant is at stage ${stage.stage} with zero logged actions.`,
      urgency: "medium",
    };
  }

  // Default
  return {
    recommendedAction: "Continue monitoring. No immediate action required.",
    reason: "Tenant is being managed within protocol guidelines.",
    urgency: "low",
  };
}
