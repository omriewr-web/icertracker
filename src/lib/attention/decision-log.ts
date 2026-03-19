/**
 * Decision Learning Loop
 *
 * Logs every recommendation shown to a user, whether they acted on it,
 * overrode it, or dismissed it — and what happened 7/30 days later.
 *
 * Over time this builds a dataset of which suggestions work for which
 * types of tenants/situations. V1 is transparent logging; V2 adds
 * reweighting of decision engine scores based on outcomes.
 */

import { prisma } from "@/lib/prisma";

export interface LogRecommendationInput {
  orgId: string;
  userId: string;
  module: string;
  entityType: string;
  entityId: string;
  recommendationCode: string;
  recommendationText: string;
  severity: string;
}

// ── Log a recommendation being shown ──────────────────────────

export async function logRecommendationShown(
  input: LogRecommendationInput
): Promise<string> {
  const log = await prisma.decisionLog.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId,
      recommendationCode: input.recommendationCode,
      recommendationText: input.recommendationText,
      severity: input.severity,
      outcome: "shown",
    },
  });
  return log.id;
}

// ── Record user action on a recommendation ────────────────────

export async function recordDecisionOutcome(
  logId: string,
  outcome: "acted" | "overridden" | "dismissed",
  userAction?: string
): Promise<void> {
  await prisma.decisionLog.update({
    where: { id: logId },
    data: {
      outcome,
      userAction: userAction ?? null,
      outcomeRecordedAt: new Date(),
    },
  });
}

// ── Record what happened after 7 or 30 days ───────────────────

export async function recordDelayedResult(
  logId: string,
  period: "7d" | "30d",
  result: "improved" | "unchanged" | "worsened" | "resolved"
): Promise<void> {
  const data: Record<string, unknown> = { resultRecordedAt: new Date() };
  if (period === "7d") data.resultAfter7d = result;
  else data.resultAfter30d = result;

  await prisma.decisionLog.update({
    where: { id: logId },
    data,
  });
}

// ── Get recommendation effectiveness stats ────────────────────

export interface RecommendationStats {
  code: string;
  module: string;
  totalShown: number;
  actedOn: number;
  overridden: number;
  dismissed: number;
  actRate: number;
  improved7d: number;
  worsened7d: number;
}

export async function getRecommendationStats(
  orgId: string,
  module?: string
): Promise<RecommendationStats[]> {
  const where: Record<string, unknown> = { orgId };
  if (module) where.module = module;

  const logs = await prisma.decisionLog.findMany({
    where,
    select: {
      recommendationCode: true,
      module: true,
      outcome: true,
      resultAfter7d: true,
    },
  });

  const grouped = new Map<string, typeof logs>();
  for (const log of logs) {
    const key = `${log.module}:${log.recommendationCode}`;
    const group = grouped.get(key) ?? [];
    group.push(log);
    grouped.set(key, group);
  }

  const stats: RecommendationStats[] = [];
  for (const [key, group] of grouped) {
    const [mod, code] = key.split(":");
    const totalShown = group.length;
    const actedOn = group.filter((l) => l.outcome === "acted").length;
    const overridden = group.filter((l) => l.outcome === "overridden").length;
    const dismissed = group.filter((l) => l.outcome === "dismissed").length;
    const improved7d = group.filter((l) => l.resultAfter7d === "improved").length;
    const worsened7d = group.filter((l) => l.resultAfter7d === "worsened").length;

    stats.push({
      code,
      module: mod,
      totalShown,
      actedOn,
      overridden,
      dismissed,
      actRate: totalShown > 0 ? Math.round((actedOn / totalShown) * 100) : 0,
      improved7d,
      worsened7d,
    });
  }

  return stats.sort((a, b) => b.totalShown - a.totalShown);
}

// ── Batch: evaluate 7-day outcomes for logged recs ────────────

export async function evaluatePendingOutcomes(orgId: string): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Find logs from ~7 days ago that haven't been evaluated yet
  const pending = await prisma.decisionLog.findMany({
    where: {
      orgId,
      outcome: { in: ["acted", "overridden"] },
      resultAfter7d: null,
      shownAt: { lte: sevenDaysAgo },
    },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      module: true,
    },
    take: 50,
  });

  let evaluated = 0;

  for (const log of pending) {
    if (log.entityType === "tenant" && log.module === "collections") {
      // Check if tenant balance improved
      const tenant = await prisma.tenant.findUnique({
        where: { id: log.entityId },
        select: { balance: true },
      });

      const snapshot = await prisma.balanceSnapshot.findFirst({
        where: {
          tenantId: log.entityId,
          snapshotDate: { lte: sevenDaysAgo },
        },
        orderBy: { snapshotDate: "desc" },
        select: { currentBalance: true },
      });

      if (tenant && snapshot) {
        const currentBal = Number(tenant.balance);
        const prevBal = Number(snapshot.currentBalance);
        let result: "improved" | "unchanged" | "worsened" | "resolved";
        if (currentBal <= 0) result = "resolved";
        else if (currentBal < prevBal * 0.9) result = "improved";
        else if (currentBal > prevBal * 1.1) result = "worsened";
        else result = "unchanged";

        await recordDelayedResult(log.id, "7d", result);
        evaluated++;
      }
    }
  }

  return evaluated;
}
