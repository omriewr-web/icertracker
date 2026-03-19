/**
 * Universal Action Card Engine
 *
 * Generates "next best action" cards for any entity by combining:
 * - Decision engine rules (decision/index.ts)
 * - Collection stage recommendations (collectionsStageService.ts)
 * - Active signals (OperationalSignal)
 * - Attention score context
 *
 * Each card has: title, reason, urgency, suggestedAction, quickActions[]
 */

import { prisma } from "@/lib/prisma";
import { runDecisionEngine, type DecisionSuggestion } from "@/lib/decision";
import { getDecisionRecommendation } from "@/lib/collections/collectionsStageService";

export interface ActionCard {
  id: string; // deterministic for dedup
  module: string;
  entityType: string;
  entityId: string;
  title: string;
  reason: string;
  urgency: "low" | "medium" | "high" | "critical";
  suggestedAction: string;
  quickActions: QuickAction[];
  source: "decision_engine" | "collection_stage" | "signal" | "computed";
}

export interface QuickAction {
  label: string;
  actionCode: string; // e.g. "log_call", "advance_stage", "send_notice", "assign_vendor"
  variant: "primary" | "secondary" | "danger";
}

// ── Tenant action cards ───────────────────────────────────────

export async function getTenantActionCards(
  tenantId: string,
  orgId: string
): Promise<ActionCard[]> {
  const cards: ActionCard[] = [];

  const [tenant, collectionStageRec, activeSignals] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        balance: true,
        marketRent: true,
        arrearsDays: true,
        leaseExpiration: true,
        leaseStatus: true,
        collectionScore: true,
        legalCases: { where: { isActive: true }, select: { id: true }, take: 1 },
      },
    }),
    getDecisionRecommendation(tenantId, orgId).catch(() => null),
    prisma.operationalSignal.findMany({
      where: { tenantId, organizationId: orgId, status: "active" },
      orderBy: { severity: "desc" },
      take: 5,
    }),
  ]);

  if (!tenant) return cards;

  // Collection stage recommendation → action card
  if (collectionStageRec && collectionStageRec.urgency !== "low") {
    const quickActions: QuickAction[] = [];
    if (collectionStageRec.recommendedAction.includes("Call")) {
      quickActions.push({ label: "Log Call", actionCode: "log_call", variant: "primary" });
    }
    if (collectionStageRec.recommendedAction.includes("notice")) {
      quickActions.push({ label: "Issue Notice", actionCode: "send_notice", variant: "primary" });
    }
    if (collectionStageRec.recommendedAction.includes("attorney") || collectionStageRec.recommendedAction.includes("Legal")) {
      quickActions.push({ label: "Refer to Legal", actionCode: "refer_legal", variant: "danger" });
    }
    if (collectionStageRec.recommendedAction.includes("Advance")) {
      quickActions.push({ label: "Advance Stage", actionCode: "advance_stage", variant: "secondary" });
    }
    if (quickActions.length === 0) {
      quickActions.push({ label: "Log Action", actionCode: "log_action", variant: "primary" });
    }

    cards.push({
      id: `csr-${tenantId}`,
      module: "collections",
      entityType: "tenant",
      entityId: tenantId,
      title: collectionStageRec.recommendedAction,
      reason: collectionStageRec.reason,
      urgency: collectionStageRec.urgency,
      suggestedAction: collectionStageRec.recommendedAction,
      quickActions,
      source: "collection_stage",
    });
  }

  // Decision engine: collections
  const balance = Number(tenant.balance);
  const rent = Number(tenant.marketRent) || 1;
  if (balance > 0) {
    const collectionSuggestions = runDecisionEngine({
      collections: [
        {
          collectionCaseId: "",
          tenantId,
          unitId: "",
          daysLate: tenant.arrearsDays,
          balanceOwed: balance,
          monthlyRent: rent,
          status: "monitoring",
          hasLegalCase: tenant.legalCases.length > 0,
          goodPaymentHistory: false,
          priorLegalCases: 0,
        },
      ],
    });

    for (const s of collectionSuggestions) {
      // Skip if already covered by collection stage rec
      if (cards.some((c) => c.source === "collection_stage")) continue;
      cards.push(decisionToCard(s, tenantId));
    }
  }

  // Decision engine: leases
  if (tenant.leaseExpiration) {
    const daysUntilExpiry = Math.floor(
      (new Date(tenant.leaseExpiration).getTime() - Date.now()) / 86400000
    );
    if (daysUntilExpiry <= 60) {
      const leaseSuggestions = runDecisionEngine({
        leases: [
          {
            leaseId: "",
            tenantId,
            unitId: "",
            leaseEndDate: tenant.leaseExpiration!,
            renewalInProgress: false,
          },
        ],
      });
      for (const s of leaseSuggestions) {
        cards.push(decisionToCard(s, tenantId));
      }
    }
  }

  // Active signals → action cards
  for (const signal of activeSignals) {
    cards.push({
      id: `sig-${signal.id}`,
      module: signal.type.replace("_risk", "").replace("_", " "),
      entityType: "tenant",
      entityId: tenantId,
      title: signal.title,
      reason: signal.description.slice(0, 200),
      urgency: signal.severity as ActionCard["urgency"],
      suggestedAction: signal.recommendedAction || "Review and take action",
      quickActions: [
        { label: "Acknowledge", actionCode: "acknowledge_signal", variant: "secondary" },
      ],
      source: "signal",
    });
  }

  // Deduplicate by id and sort by urgency
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const seen = new Set<string>();
  return cards
    .filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    })
    .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
}

// ── Building action cards ─────────────────────────────────────

export async function getBuildingActionCards(
  buildingId: string,
  orgId: string
): Promise<ActionCard[]> {
  const cards: ActionCard[] = [];

  const signals = await prisma.operationalSignal.findMany({
    where: { buildingId, organizationId: orgId, status: "active" },
    orderBy: { severity: "desc" },
    take: 10,
  });

  for (const signal of signals) {
    cards.push({
      id: `sig-${signal.id}`,
      module: signal.type.replace("_risk", "").replace("_", " "),
      entityType: "building",
      entityId: buildingId,
      title: signal.title,
      reason: signal.description.slice(0, 200),
      urgency: signal.severity as ActionCard["urgency"],
      suggestedAction: signal.recommendedAction || "Review and take action",
      quickActions: [
        { label: "Acknowledge", actionCode: "acknowledge_signal", variant: "secondary" },
      ],
      source: "signal",
    });
  }

  return cards;
}

// ── Work order action cards ───────────────────────────────────

export async function getWorkOrderActionCards(
  workOrderId: string,
  orgId: string
): Promise<ActionCard[]> {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      id: true,
      status: true,
      priority: true,
      assignedToId: true,
      vendorId: true,
      createdAt: true,
      updatedAt: true,
      dueDate: true,
      category: true,
    },
  });

  if (!wo) return [];

  const cards: ActionCard[] = [];

  const hoursSinceCreated =
    (Date.now() - new Date(wo.createdAt).getTime()) / 3600000;
  const hoursSinceUpdated =
    (Date.now() - new Date(wo.updatedAt).getTime()) / 3600000;

  const suggestions = runDecisionEngine({
    workOrders: [
      {
        workOrderId: workOrderId,
        estimatedHours: 0,
        requiresSpecialSkill: false,
        assignedUserId: wo.assignedToId,
        assignedVendorId: wo.vendorId,
        openedAt: wo.createdAt,
        lastUpdatedAt: wo.updatedAt,
        status: wo.status,
      },
    ],
  });

  for (const s of suggestions) {
    cards.push(decisionToCard(s, workOrderId));
  }

  // Overdue check
  if (wo.dueDate && new Date(wo.dueDate) < new Date() && wo.status !== "COMPLETED") {
    cards.push({
      id: `wo-overdue-${workOrderId}`,
      module: "work_orders",
      entityType: "work_order",
      entityId: workOrderId,
      title: "Work order is past due",
      reason: `Due date was ${new Date(wo.dueDate).toLocaleDateString()}`,
      urgency: "high",
      suggestedAction: "Update status or reschedule",
      quickActions: [
        { label: "Update Status", actionCode: "update_wo_status", variant: "primary" },
      ],
      source: "computed",
    });
  }

  return cards;
}

// ── Helper ────────────────────────────────────────────────────

function decisionToCard(s: DecisionSuggestion, entityId: string): ActionCard {
  return {
    id: `dec-${s.code}-${entityId}`,
    module: s.module,
    entityType: s.entityType ?? "tenant",
    entityId: s.entityId ?? entityId,
    title: s.title,
    reason: s.reason,
    urgency: s.severity,
    suggestedAction: s.suggestedAction,
    quickActions: [
      { label: "Take Action", actionCode: s.code.toLowerCase(), variant: "primary" },
    ],
    source: "decision_engine",
  };
}
