import { prisma } from "@/lib/prisma";
import type { ViolationSource, WorkOrderCategory, WorkOrderPriority } from "@prisma/client";

interface InterceptorResult {
  workOrderId: string | null;
  ruleApplied: any | null;
  lifecycleStatus: string;
  escalationScheduled: boolean;
}

interface ViolationInput {
  id: string;
  class: string | null;
  severity: string | null;
  description: string;
  source: ViolationSource;
  buildingId: string;
  externalId: string;
  orgId?: string | null;
}

/**
 * Intercepts a violation after sync and determines whether to auto-create a WorkOrder.
 * Replaces the inline auto-create logic previously in violation-sync.ts.
 */
export async function interceptViolation(
  violation: ViolationInput,
  buildingId: string,
  orgId?: string | null,
): Promise<InterceptorResult> {
  try {
    // 1. Look up matching ViolationRuleMapping by agency + defectPattern (case-insensitive)
    const agency = violation.source as string;
    const rule = await prisma.violationRuleMapping.findFirst({
      where: {
        agency,
        isActive: true,
        defectPattern: { contains: violation.description?.substring(0, 100) || "", mode: "insensitive" },
        OR: [
          { organizationId: orgId ?? undefined },
          { organizationId: null },
        ],
      },
      orderBy: [
        { organizationId: "desc" }, // prefer org-specific rules
        { confidenceScore: "desc" },
      ],
    });

    // 2. Determine defaults if no rule found
    const category: WorkOrderCategory = rule?.internalCategory ?? "GENERAL";
    const priority: WorkOrderPriority = rule?.defaultPriority ?? getDefaultPriority(violation.class);
    const trade = rule?.internalTrade ?? null;

    // 3. Check if auto-dispatch is warranted
    const shouldDispatch =
      violation.class === "C" ||
      violation.severity === "IMMEDIATELY_HAZARDOUS" ||
      (rule && priority === "URGENT");

    if (!shouldDispatch) {
      // Triage only — no WO created
      await prisma.violation.update({
        where: { id: violation.id },
        data: {
          lifecycleStatus: "TRIAGED",
          triagedAt: new Date(),
        },
      });

      return {
        workOrderId: null,
        ruleApplied: rule,
        lifecycleStatus: "TRIAGED",
        escalationScheduled: false,
      };
    }

    // 4. Check for existing WO already linked
    const existingWo = await prisma.workOrder.findFirst({
      where: { violationId: violation.id },
      select: { id: true },
    });

    if (existingWo) {
      return {
        workOrderId: existingWo.id,
        ruleApplied: rule,
        lifecycleStatus: "DISPATCHED",
        escalationScheduled: false,
      };
    }

    // 5. Auto-create WorkOrder
    const wo = await prisma.workOrder.create({
      data: {
        title: `[AUTO] ${agency} Violation - ${violation.externalId}`,
        description: `Auto-created from ${agency} violation.\n\n${violation.description}`,
        status: "OPEN",
        priority,
        category,
        trade,
        buildingId,
        violationId: violation.id,
      },
    });

    // 6. Update violation lifecycle
    await prisma.violation.update({
      where: { id: violation.id },
      data: {
        linkedWorkOrderId: wo.id,
        lifecycleStatus: "DISPATCHED",
        triagedAt: new Date(),
        dispatchedAt: new Date(),
      },
    });

    return {
      workOrderId: wo.id,
      ruleApplied: rule,
      lifecycleStatus: "DISPATCHED",
      escalationScheduled: false,
    };
  } catch (err: any) {
    console.error(`[Interceptor] Error processing violation ${violation.id}:`, err.message);
    return {
      workOrderId: null,
      ruleApplied: null,
      lifecycleStatus: "INGESTED",
      escalationScheduled: false,
    };
  }
}

function getDefaultPriority(violationClass: string | null): WorkOrderPriority {
  switch (violationClass) {
    case "C": return "URGENT";
    case "B": return "MEDIUM";
    case "A": return "LOW";
    default: return "MEDIUM";
  }
}
