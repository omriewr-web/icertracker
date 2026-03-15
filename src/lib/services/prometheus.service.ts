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
  affectedUnits?: string[];
  keyDates?: string[];
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

const EXTRACTION_SYSTEM = `You are an expert NYC property manager assistant. When given email chains, PDFs, or documents, extract ALL relevant operational information including timelines, affected units, tenant names, and recurring issues. Respond ONLY with valid JSON, no preamble, no markdown backticks.`;

const EXTRACTION_JSON_SCHEMA = `{
  "issueDescription": "full description of the issue",
  "unitNumber": "unit number or empty string",
  "contactName": "tenant or contact name",
  "incidentDate": "ISO date string or null",
  "urgency": "low|medium|high|emergency",
  "suggestedCategory": "PLUMBING|ELECTRICAL|HVAC|APPLIANCE|GENERAL|OTHER",
  "suggestedPriority": "LOW|MEDIUM|HIGH|URGENT",
  "summary": "2-3 sentence summary including timeline if available",
  "affectedUnits": ["array of unit numbers mentioned"],
  "keyDates": ["array of important dates mentioned"]
}`;

const EXTRACTION_USER = (body: string) =>
  `Extract structured data from this maintenance intake:\n\n"""${body}"""\n\nRespond ONLY with valid JSON:\n${EXTRACTION_JSON_SCHEMA}`;

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
  if (!intake) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[Prometheus] ANTHROPIC_API_KEY not configured");
    return null;
  }

  const anthropic = new Anthropic({ apiKey });

  // Check for PDF base64 attachments
  const attachments = Array.isArray(intake.attachmentUrls) ? (intake.attachmentUrls as string[]) : [];
  const pdfAttachments = attachments.filter((url) => typeof url === "string" && url.startsWith("data:application/pdf;base64,"));

  try {
    let userContent: Anthropic.MessageCreateParams["messages"][0]["content"];

    if (pdfAttachments.length > 0) {
      // Build multi-part content with PDF documents
      const contentParts: any[] = [];
      for (const pdfDataUrl of pdfAttachments) {
        const base64Data = pdfDataUrl.replace("data:application/pdf;base64,", "");
        contentParts.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Data },
        });
      }
      contentParts.push({
        type: "text",
        text: `Extract all operational information from the document(s) above and any text below.\n${intake.rawBody ? "Additional context: " + intake.rawBody : ""}\nRespond ONLY with valid JSON:\n${EXTRACTION_JSON_SCHEMA}`,
      });
      userContent = contentParts;
    } else if (intake.rawBody) {
      userContent = EXTRACTION_USER(intake.rawBody);
    } else {
      return null;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const parsed = safeParse<AIExtractionResult>(text);
    if (!parsed) {
      console.error("[Prometheus] Failed to parse AI extraction response");
      return null;
    }

    // Also run keyword-based trade triage
    const trade = triageWorkOrderTrade(intake.rawBody || parsed.issueDescription);
    const priority = mapUrgencyToPriority(parsed.urgency);

    // Build summary with affectedUnits and keyDates if present
    let fullSummary = parsed.summary;
    if (parsed.affectedUnits?.length) {
      fullSummary += `\nAffected units: ${parsed.affectedUnits.join(", ")}`;
    }
    if (parsed.keyDates?.length) {
      fullSummary += `\nKey dates: ${parsed.keyDates.join(", ")}`;
    }

    await prisma.prometheusIntake.update({
      where: { id: intakeId },
      data: {
        extractedIssue: parsed.issueDescription,
        extractedUnit: parsed.unitNumber,
        extractedContact: parsed.contactName,
        extractedDate: parsed.incidentDate ? new Date(parsed.incidentDate) : null,
        aiSummary: fullSummary,
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

// ── 6. enrichWithPortfolioContext ─────────────────────────────────

export async function enrichWithPortfolioContext(intakeId: string) {
  const empty = {
    buildingMatch: null as { id: string; address: string; totalUnits: number } | null,
    tenantMatches: [] as { id: string; name: string; unitNumber: string; balance: number }[],
    openViolations: [] as { id: string; externalId: string; description: string; class: string | null; source: string; respondByDate: Date | null }[],
    recentWorkOrders: [] as { id: string; title: string; status: string; createdAt: Date }[],
    openLegalCases: [] as { id: string; stage: string; tenantName: string }[],
  };

  try {
    const intake = await prisma.prometheusIntake.findUnique({
      where: { id: intakeId },
      select: { buildingId: true, extractedUnit: true, extractedContact: true, extractedIssue: true },
    });
    if (!intake?.buildingId) return empty;

    const building = await prisma.building.findUnique({
      where: { id: intake.buildingId },
      select: { id: true, address: true, totalUnits: true },
    });

    // Tenants via units in this building
    const unitWhere: any = { buildingId: intake.buildingId };
    if (intake.extractedUnit) unitWhere.unitNumber = { contains: intake.extractedUnit, mode: "insensitive" };
    const units = await prisma.unit.findMany({
      where: unitWhere,
      select: { unitNumber: true, tenant: { select: { id: true, name: true, balance: true } } },
      take: 20,
    });
    const tenantMatches = units
      .filter((u) => u.tenant)
      .map((u) => ({
        id: u.tenant!.id,
        name: u.tenant!.name,
        unitNumber: u.unitNumber,
        balance: Number(u.tenant!.balance),
      }));

    const openViolations = await prisma.violation.findMany({
      where: { buildingId: intake.buildingId, isOpen: true },
      select: { id: true, externalId: true, description: true, class: true, source: true, respondByDate: true },
      orderBy: { issuedDate: "desc" },
      take: 10,
    });

    const recentWorkOrders = await prisma.workOrder.findMany({
      where: { buildingId: intake.buildingId },
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const legalCases = await prisma.legalCase.findMany({
      where: { buildingId: intake.buildingId, stage: { notIn: ["SETTLED"] }, isActive: true },
      select: { id: true, stage: true, tenant: { select: { name: true } } },
      take: 5,
    });

    return {
      buildingMatch: building ? { id: building.id, address: building.address, totalUnits: building.totalUnits } : null,
      tenantMatches,
      openViolations: openViolations.map((v) => ({ ...v, source: v.source as string })),
      recentWorkOrders,
      openLegalCases: legalCases.map((lc) => ({ id: lc.id, stage: lc.stage as string, tenantName: lc.tenant.name })),
    };
  } catch (err: any) {
    console.error("[Prometheus] Portfolio context error:", err.message);
    return empty;
  }
}

// ── 7. analyzeNYCLegalExposure ───────────────────────────────────

type ExposureLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export function analyzeNYCLegalExposure(
  extractedIssue: string | null,
  portfolioContext: Awaited<ReturnType<typeof enrichWithPortfolioContext>>,
  incidentMonth?: number,
) {
  let exposureLevel: ExposureLevel = "NONE";
  const triggers: string[] = [];
  const relevantLaws: string[] = [];
  const recommendedActions: string[] = [];
  let hpdComplaintRisk = false;
  let isChronicIssue = false;
  let chronicCount = 0;

  const issue = (extractedIssue || "").toLowerCase();

  const heatKeywords = ["heat", "hot water", "boiler", "no heat", "cold water", "steam"];
  const moldKeywords = ["mold", "mildew", "fungus", "black spots", "moisture damage"];
  const pestKeywords = ["roach", "rat", "mice", "mouse", "bed bug", "pest", "infestation", "vermin"];
  const elevatorKeywords = ["elevator", "lift", "elevator out", "stuck in elevator"];

  if (heatKeywords.some((kw) => issue.includes(kw))) {
    exposureLevel = "HIGH";
    triggers.push("NYC Admin Code §27-2029 (heat) and §27-2031 (hot water) — potential violation");
    relevantLaws.push(
      "Heat Season Oct 1–May 31",
      "68°F required daytime when outdoor <55°F",
      "55°F required nighttime when outdoor <40°F",
      "Hot water 120°F required year-round",
    );
    recommendedActions.push(
      "Dispatch repair immediately",
      "Document all access attempts",
      "Notify tenants in writing with ETA",
      "Retain boiler service records",
    );
    hpdComplaintRisk = true;
  }

  if (moldKeywords.some((kw) => issue.includes(kw))) {
    exposureLevel = "HIGH";
    triggers.push("NYC Local Law 55 (2018) — Indoor Allergen Hazards");
    relevantLaws.push("LL55/2018 requires mold assessment and remediation", "HPD can issue Class B violation");
    recommendedActions.push("Schedule mold assessment", "Document moisture source", "Remediate per EPA guidelines");
    hpdComplaintRisk = true;
  }

  if (pestKeywords.some((kw) => issue.includes(kw))) {
    if (exposureLevel === "NONE") exposureLevel = "MEDIUM";
    triggers.push("NYC Housing Maintenance Code §27-2018");
    relevantLaws.push("Owner responsible for pest-free premises", "Bed bugs require written disclosure to all tenants");
    recommendedActions.push("Schedule exterminator", "Document treatment plan");
    hpdComplaintRisk = true;
  }

  if (elevatorKeywords.some((kw) => issue.includes(kw))) {
    const totalUnits = portfolioContext.buildingMatch?.totalUnits ?? 0;
    const elevExposure: ExposureLevel = totalUnits > 6 ? "HIGH" : "MEDIUM";
    if (elevExposure === "HIGH" || exposureLevel === "NONE") exposureLevel = elevExposure;
    triggers.push("DOB elevator violation risk — NYC BC §28-304");
    relevantLaws.push("Elevator maintenance required", "DOB must be notified of outages >24hrs");
    recommendedActions.push("Contact elevator service company", "Post notice in lobby");
  }

  // Open Class C violations escalation
  const classCCount = portfolioContext.openViolations.filter((v) => v.class === "C").length;
  if (classCCount > 0) {
    exposureLevel = "CRITICAL";
    triggers.push(`Building has ${classCCount} open Class C (immediately hazardous) violation${classCCount > 1 ? "s" : ""}`);
  }

  // Chronic issue detection
  if (extractedIssue) {
    const issueWords = extractedIssue.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    chronicCount = portfolioContext.recentWorkOrders.filter((wo) => {
      const woText = wo.title.toLowerCase();
      return issueWords.some((w) => woText.includes(w));
    }).length;
    isChronicIssue = chronicCount >= 3;
    if (isChronicIssue) {
      triggers.push(`CHRONIC ISSUE — same problem found in ${chronicCount} recent work orders`);
      recommendedActions.push("Escalate to URGENT priority — recurring issue pattern detected");
    }
  }

  return { exposureLevel, triggers, relevantLaws, recommendedActions, hpdComplaintRisk, isChronicIssue, chronicCount };
}

// ── 8. generateTenantResponseEmail ──────────────────────────────

const EMAIL_SYSTEM = `You are a professional NYC property manager drafting a response to a tenant maintenance complaint.
Write professionally, acknowledge the issue, provide next steps, and protect the owner legally.
Never admit fault or liability. Never promise specific timeframes you cannot guarantee.
Respond ONLY with valid JSON: { "subject": "string", "body": "string" }`;

export async function generateTenantResponseEmail(
  intake: { extractedIssue: string | null; extractedUnit: string | null; extractedContact: string | null; rawBody: string | null },
  exposure: ReturnType<typeof analyzeNYCLegalExposure>,
  portfolioContext: Awaited<ReturnType<typeof enrichWithPortfolioContext>>,
): Promise<{ subject: string; body: string }> {
  const fallback = {
    subject: "Re: Your Maintenance Request",
    body: "Dear Resident, We have received your maintenance request and our team is working to address it promptly. We will follow up with an update as soon as possible.\n\nThank you for your patience.\n\nBuilding Management",
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: EMAIL_SYSTEM,
      messages: [{
        role: "user",
        content: JSON.stringify({
          issue: intake.extractedIssue,
          unit: intake.extractedUnit,
          tenantName: intake.extractedContact,
          exposureLevel: exposure.exposureLevel,
          relevantLaws: exposure.relevantLaws,
          buildingAddress: portfolioContext.buildingMatch?.address,
          isChronicIssue: exposure.isChronicIssue,
        }),
      }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    return safeParse<{ subject: string; body: string }>(text) ?? fallback;
  } catch (err: any) {
    console.error("[Prometheus] Email generation error:", err.message);
    return fallback;
  }
}

// ── 9. autoLinkViolations ───────────────────────────────────────

export async function autoLinkViolations(
  draftId: string,
  portfolioContext: Awaited<ReturnType<typeof enrichWithPortfolioContext>>,
  extractedIssue: string | null,
): Promise<{ linkedViolationIds: string[]; matchCount: number }> {
  if (!extractedIssue || portfolioContext.openViolations.length === 0) {
    return { linkedViolationIds: [], matchCount: 0 };
  }

  const issueWords = extractedIssue.toLowerCase().split(/\W+/).filter((w) => w.length > 3);

  const scored = portfolioContext.openViolations.map((v) => {
    const text = (v.description || "").toLowerCase();
    const score = issueWords.filter((w) => text.includes(w)).length;
    return { ...v, score };
  });

  const matched = scored.filter((v) => v.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  const linkedViolationIds = matched.map((v) => v.id);

  if (linkedViolationIds.length > 0) {
    try {
      // Append violation references to similarWOIds
      const draft = await prisma.workOrderDraft.findUnique({ where: { id: draftId }, select: { similarWOIds: true } });
      const existing = Array.isArray(draft?.similarWOIds) ? (draft.similarWOIds as string[]) : [];
      const violationRefs = linkedViolationIds.map((id) => `violation:${id}`);
      await prisma.workOrderDraft.update({
        where: { id: draftId },
        data: { similarWOIds: [...existing, ...violationRefs] },
      });
    } catch (err: any) {
      console.error("[Prometheus] Auto-link violations error:", err.message);
    }
  }

  return { linkedViolationIds, matchCount: linkedViolationIds.length };
}

// ── 10. promoteDraftToWorkOrder ──────────────────────────────────

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
