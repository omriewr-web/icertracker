import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { triageWorkOrderTrade } from "@/lib/ai/asset-manager";

// ── Types ────────────────────────────────────────────────────────

interface CreateIntakeInput {
  buildingId: string;
  unitId?: string;
  rawBody: string;
  attachmentUrls?: string[];
  userId: string;
  orgId?: string;
  source?: string;
}

interface AIExtractionResult {
  issueDescription: string;
  unitNumber: string | null;
  contactName: string | null;
  incidentDate: string | null;
  urgency: string;
  suggestedCategory: string;
  suggestedPriority: string;
  summary: string;
}

interface SimilarWorkOrder {
  id: string;
  title: string;
  description: string | null;
  completedDate: string | null;
}

interface AIReviewResult {
  flaggedIssues: string[];
  completenessScore: number;
  readyForPromotion: boolean;
}

// ── 1. createIntakeManual ────────────────────────────────────────

export async function createIntakeManual(input: CreateIntakeInput) {
  return prisma.prometheusIntake.create({
    data: {
      organizationId: input.orgId ?? null,
      buildingId: input.buildingId,
      unitId: input.unitId ?? null,
      source: input.source ?? "MANUAL",
      rawBody: input.rawBody,
      attachmentUrls: input.attachmentUrls ?? Prisma.JsonNull,
      createdByUserId: input.userId,
      status: "pending",
    },
  });
}

// ── 2. runAIExtraction ───────────────────────────────────────────

const EXTRACTION_SYSTEM = `You are an expert NYC property manager assistant. Extract structured information from maintenance reports. Respond ONLY with valid JSON, no preamble, no markdown backticks.`;

const EXTRACTION_USER = (body: string) =>
  `Extract structured data from this maintenance intake:\n\n"""${body}"""\n\nRespond with JSON:\n{ "issueDescription": string, "unitNumber": string or null, "contactName": string or null, "incidentDate": ISO string or null, "urgency": "low"|"medium"|"high"|"emergency", "suggestedCategory": "PLUMBING"|"ELECTRICAL"|"HVAC"|"APPLIANCE"|"GENERAL"|"OTHER", "suggestedPriority": "LOW"|"MEDIUM"|"HIGH"|"URGENT", "summary": string }`;

function mapUrgencyToPriority(urgency: string): string {
  switch (urgency) {
    case "emergency": return "URGENT";
    case "high": return "HIGH";
    case "medium": return "MEDIUM";
    case "low": return "LOW";
    default: return "MEDIUM";
  }
}

function safeParse<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function runAIExtraction(intakeId: string): Promise<AIExtractionResult | null> {
  const intake = await prisma.prometheusIntake.findUnique({ where: { id: intakeId } });
  if (!intake?.rawBody) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[Prometheus] ANTHROPIC_API_KEY not configured");
    return null;
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: "user", content: EXTRACTION_USER(intake.rawBody) }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const parsed = safeParse<AIExtractionResult>(text);
    if (!parsed) {
      console.error("[Prometheus] Failed to parse AI extraction response");
      return null;
    }

    // Also run keyword-based trade triage
    const trade = triageWorkOrderTrade(intake.rawBody);
    const priority = mapUrgencyToPriority(parsed.urgency);

    await prisma.prometheusIntake.update({
      where: { id: intakeId },
      data: {
        extractedIssue: parsed.issueDescription,
        extractedUnit: parsed.unitNumber,
        extractedContact: parsed.contactName,
        extractedDate: parsed.incidentDate ? new Date(parsed.incidentDate) : null,
        aiSummary: parsed.summary,
        status: "extracted",
      },
    });

    return { ...parsed, suggestedPriority: priority, suggestedCategory: parsed.suggestedCategory || trade };
  } catch (err: any) {
    console.error("[Prometheus] AI extraction error:", err.message);
    return null;
  }
}

// ── 3. findSimilarWorkOrders ─────────────────────────────────────

export async function findSimilarWorkOrders(
  buildingId: string,
  category: string,
  description: string,
): Promise<SimilarWorkOrder[]> {
  const workOrders = await prisma.workOrder.findMany({
    where: {
      buildingId,
      category: category as any,
      status: "COMPLETED",
    },
    select: { id: true, title: true, description: true, completedDate: true },
    orderBy: { completedDate: "desc" },
    take: 20,
  });

  // Score by keyword overlap
  const words = description.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const scored = workOrders.map((wo) => {
    const text = `${wo.title} ${wo.description || ""}`.toLowerCase();
    const matches = words.filter((w) => text.includes(w)).length;
    return { ...wo, score: matches };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((wo) => ({
      id: wo.id,
      title: wo.title,
      description: wo.description,
      completedDate: wo.completedDate?.toISOString() ?? null,
    }));
}

// ── 4. runAIReview ───────────────────────────────────────────────

const REVIEW_SYSTEM = `You are a property management compliance reviewer. Review this work order draft and identify missing information that could be legally or operationally problematic. Respond ONLY with valid JSON.`;

const REVIEW_USER = (draft: any) =>
  `Review this work order draft:\n\nTitle: ${draft.title}\nDescription: ${draft.description}\nCategory: ${draft.category}\nPriority: ${draft.priority}\nTrade: ${draft.trade || "not set"}\nScheduled Date: ${draft.scheduledDate || "not set"}\nIncident Date: ${draft.incidentDate || "not set"}\nAssigned To: ${draft.assignedToId ? "yes" : "no"}\nUnit: ${draft.unitId ? "yes" : "not specified"}\nAccess Attempts: ${JSON.stringify(draft.accessAttempts || [])}\n\nRespond with JSON:\n{ "flaggedIssues": string[], "completenessScore": 0-100, "readyForPromotion": boolean }`;

export async function runAIReview(draftId: string): Promise<AIReviewResult> {
  const fallback: AIReviewResult = { flaggedIssues: [], completenessScore: 50, readyForPromotion: false };

  const draft = await prisma.workOrderDraft.findUnique({ where: { id: draftId } });
  if (!draft) return fallback;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: REVIEW_SYSTEM,
      messages: [{ role: "user", content: REVIEW_USER(draft) }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const parsed = safeParse<AIReviewResult>(text);
    const result = parsed ?? fallback;

    // Additional rule-based flags
    const flags = [...(result.flaggedIssues || [])];
    if (!draft.incidentDate) flags.push("No incident date recorded");
    if (!draft.unitId) flags.push("No unit specified");
    if (draft.description.split(/\s+/).length < 20) flags.push("Description is under 20 words");
    if (draft.priority === "URGENT" && !draft.scheduledDate) flags.push("URGENT priority but no scheduled date");
    if ((draft.priority === "HIGH" || draft.priority === "URGENT") && !draft.assignedToId) flags.push("High/Urgent priority with no assignee");

    // Deduplicate
    const uniqueFlags = [...new Set(flags)];

    await prisma.workOrderDraft.update({
      where: { id: draftId },
      data: { flaggedIssues: uniqueFlags },
    });

    return { flaggedIssues: uniqueFlags, completenessScore: result.completenessScore, readyForPromotion: result.readyForPromotion };
  } catch (err: any) {
    console.error("[Prometheus] AI review error:", err.message);
    return fallback;
  }
}

// ── 5. promoteDraftToWorkOrder ───────────────────────────────────

export async function promoteDraftToWorkOrder(draftId: string, userId: string): Promise<{ workOrderId: string }> {
  return prisma.$transaction(async (tx) => {
    const draft = await tx.workOrderDraft.findUnique({ where: { id: draftId } });
    if (!draft) throw new Error("Draft not found");
    if (draft.promotedToWOId) throw new Error("Draft already promoted");

    const wo = await tx.workOrder.create({
      data: {
        title: draft.title,
        description: draft.description,
        status: "OPEN",
        priority: draft.priority,
        category: draft.category,
        trade: draft.trade,
        buildingId: draft.buildingId,
        unitId: draft.unitId,
        tenantId: draft.tenantId,
        vendorId: draft.vendorId,
        assignedToId: draft.assignedToId,
        scheduledDate: draft.scheduledDate,
        photos: draft.photoUrls as any,
        createdById: userId,
        sourceType: "prometheus",
        sourceId: draftId,
      },
    });

    await tx.workOrderDraft.update({
      where: { id: draftId },
      data: { status: "promoted", promotedToWOId: wo.id },
    });

    if (draft.intakeId) {
      await tx.prometheusIntake.update({
        where: { id: draft.intakeId },
        data: { status: "converted", convertedWOId: wo.id },
      });
    }

    await tx.activityEvent.create({
      data: {
        eventType: "work_order_created",
        title: `Work order created from Prometheus: ${draft.title}`,
        relatedRecordType: "WorkOrder",
        relatedRecordId: wo.id,
        buildingId: draft.buildingId,
        createdByUserId: userId,
      },
    });

    return { workOrderId: wo.id };
  });
}
