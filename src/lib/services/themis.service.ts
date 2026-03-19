// AI_GUARDRAIL: This service returns recommendations only.
// It must never directly mutate financial records.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { triageWorkOrderTrade } from "@/lib/ai/asset-manager";
import { AI_MODEL } from "@/lib/ai-config";

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
    console.error("[Themis] ANTHROPIC_API_KEY not configured");
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

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI request timed out after 30s")), 30000)
    );
    const response = await Promise.race([
      anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: 1024,
        system: EXTRACTION_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
      timeoutPromise,
    ]);

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const parsed = safeParse<AIExtractionResult>(text);
    if (!parsed) {
      console.error("[Themis] Failed to parse AI extraction response");
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
    console.error("[Themis] AI extraction error:", err.message);
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
    const reviewTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI request timed out after 30s")), 30000)
    );
    const response = await Promise.race([
      anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: 1024,
        system: REVIEW_SYSTEM,
        messages: [{ role: "user", content: REVIEW_USER(draft) }],
      }),
      reviewTimeoutPromise,
    ]);

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
    console.error("[Themis] AI review error:", err.message);
    return fallback;
  }
}

// ── 6. enrichWithPortfolioContext ─────────────────────────────────

export async function enrichWithPortfolioContext(intakeId: string) {
  const empty = {
    buildingMatch: null as { id: string; address: string; totalUnits: number } | null,
    tenantMatches: [] as { id: string; name: string; unitNumber: string; balance: number; leaseStatus: string | null; moveInDate: Date | null }[],
    openViolations: [] as { id: string; externalId: string; description: string; class: string | null; source: string; respondByDate: Date | null; issuedDate: Date | null }[],
    recentWorkOrders: [] as { id: string; title: string; status: string; category: string; createdAt: Date; completedDate: Date | null }[],
    openLegalCases: [] as { id: string; stage: string; tenantName: string; filedDate: Date | null }[],
    tenantNotes: [] as { id: string; content: string; createdAt: Date; category: string | null }[],
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
      select: {
        unitNumber: true,
        tenant: { select: { id: true, name: true, balance: true, leaseStatus: true, moveInDate: true } },
      },
      take: 20,
    });
    const tenantMatches = units
      .filter((u) => u.tenant)
      .map((u) => ({
        id: u.tenant!.id,
        name: u.tenant!.name,
        unitNumber: u.unitNumber,
        balance: Number(u.tenant!.balance),
        leaseStatus: u.tenant!.leaseStatus ?? null,
        moveInDate: u.tenant!.moveInDate ?? null,
      }))
      .slice(0, 5);

    const openViolations = await prisma.violation.findMany({
      where: { buildingId: intake.buildingId, isOpen: true },
      select: { id: true, externalId: true, description: true, class: true, source: true, respondByDate: true, issuedDate: true },
      orderBy: { issuedDate: "desc" },
      take: 10,
    });

    const recentWorkOrders = await prisma.workOrder.findMany({
      where: { buildingId: intake.buildingId },
      select: { id: true, title: true, status: true, category: true, createdAt: true, completedDate: true },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    const legalCases = await prisma.legalCase.findMany({
      where: { buildingId: intake.buildingId, stage: { notIn: ["SETTLED"] }, isActive: true },
      select: { id: true, stage: true, filedDate: true, tenant: { select: { name: true } } },
      take: 5,
    });

    // Fetch tenant notes for matched tenants
    let tenantNotes: typeof empty.tenantNotes = [];
    if (tenantMatches.length > 0) {
      const matchedTenantIds = tenantMatches.map((t) => t.id);
      const notes = await prisma.tenantNote.findMany({
        where: { tenantId: { in: matchedTenantIds } },
        select: { id: true, text: true, createdAt: true, category: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      tenantNotes = notes.map((n) => ({ id: n.id, content: n.text, createdAt: n.createdAt, category: n.category as string | null }));
    }

    return {
      buildingMatch: building ? { id: building.id, address: building.address, totalUnits: building.totalUnits } : null,
      tenantMatches,
      openViolations: openViolations.map((v) => ({ ...v, source: v.source as string })),
      recentWorkOrders: recentWorkOrders.map((wo) => ({ ...wo, category: wo.category as string })),
      openLegalCases: legalCases.map((lc) => ({ id: lc.id, stage: lc.stage as string, tenantName: lc.tenant.name, filedDate: lc.filedDate })),
      tenantNotes,
    };
  } catch (err: any) {
    console.error("[Themis] Portfolio context error:", err.message);
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

  const heatKeywords = ["heat", "hot water", "boiler", "no heat", "cold water", "steam", "no steam"];
  const moldKeywords = ["mold", "mildew", "fungus", "black spots", "moisture damage", "water damage"];
  const leadKeywords = ["lead", "lead paint", "peeling paint", "chipping paint"];
  const windowKeywords = ["window", "window guard", "window screen", "broken window", "fell from window"];
  const pestKeywords = ["roach", "cockroach", "rat", "mice", "mouse", "bed bug", "bedbugs", "pest", "rodent", "infestation", "vermin"];
  const elevatorKeywords = ["elevator", "lift", "elevator out", "stuck", "elevator broken"];

  if (heatKeywords.some((kw) => issue.includes(kw))) {
    exposureLevel = "HIGH";
    triggers.push("NYC Admin Code §27-2029 (heat) and §27-2031 (hot water)");
    relevantLaws.push(
      "Heat Season Oct 1–May 31",
      "Required 68°F daytime when outdoor <55°F",
      "Required 55°F overnight when outdoor <40°F",
      "Hot water 120°F required year-round",
    );
    recommendedActions.push(
      "Dispatch repair same day",
      "Document all access attempts",
      "Send written ETA to tenants",
      "Retain all boiler service records",
      "Log every reset attempt with timestamp",
    );
    hpdComplaintRisk = true;
  }

  if (moldKeywords.some((kw) => issue.includes(kw))) {
    exposureLevel = "HIGH";
    triggers.push("NYC Local Law 55 (2018) — Indoor Allergen Hazards Act");
    relevantLaws.push(
      "LL55/2018 requires mold assessment within 7 days",
      "HPD Class B violation likely",
      "Remediation required within 30 days",
    );
    recommendedActions.push("Schedule mold assessment within 7 days", "Document moisture source", "Remediate per EPA guidelines");
    hpdComplaintRisk = true;
  }

  if (leadKeywords.some((kw) => issue.includes(kw))) {
    exposureLevel = "CRITICAL";
    triggers.push("NYC Local Law 1 (2004) — Lead Paint Hazard Reduction");
    relevantLaws.push(
      "LL1/2004 applies to pre-1960 buildings with children under 6",
      "Annual inspection required",
      "XRF test may be required",
      "Civil and criminal penalties for non-compliance",
    );
    recommendedActions.push(
      "Engage certified lead inspector immediately",
      "Do not disturb paint until tested",
      "Notify all affected tenants in writing",
    );
    hpdComplaintRisk = true;
  }

  if (windowKeywords.some((kw) => issue.includes(kw))) {
    exposureLevel = "HIGH";
    triggers.push("NYC Admin Code §27-2043.1 — Window Guards Required");
    relevantLaws.push(
      "Window guards required in apartments with children under 11",
      "Annual notice required to all tenants",
      "Class B violation for non-compliance",
    );
    recommendedActions.push("Install or repair window guards immediately", "Send annual window guard notice");
    hpdComplaintRisk = true;
  }

  if (pestKeywords.some((kw) => issue.includes(kw))) {
    if (exposureLevel === "NONE") exposureLevel = "MEDIUM";
    triggers.push("NYC Housing Maintenance Code §27-2018");
    relevantLaws.push(
      "Owner responsible for pest-free premises",
      "Bed bug disclosure required",
      "Annual bed bug reporting to HPD",
    );
    recommendedActions.push("Schedule exterminator", "Document treatment plan", "Issue bed bug disclosure if applicable");
    hpdComplaintRisk = true;
  }

  if (elevatorKeywords.some((kw) => issue.includes(kw))) {
    const totalUnits = portfolioContext.buildingMatch?.totalUnits ?? 0;
    const elevExposure: ExposureLevel = totalUnits > 6 ? "HIGH" : "MEDIUM";
    if (elevExposure === "HIGH" || exposureLevel === "NONE") exposureLevel = elevExposure;
    triggers.push("NYC BC §28-304 — Elevator Maintenance");
    relevantLaws.push(
      "Periodic inspection required",
      "DOB notification required for outages >24hrs",
      "Category 1/5 tests required annually",
    );
    recommendedActions.push("Contact elevator service company", "Post notice in lobby with estimated restoration time");
  }

  // Open Class C violations escalation
  const classCCount = portfolioContext.openViolations.filter((v) => v.class === "C").length;
  const hasOpenClassC = classCCount > 0;
  if (hasOpenClassC) {
    exposureLevel = "CRITICAL";
    triggers.push(`Building has ${classCCount} open Class C (immediately hazardous) violation${classCCount > 1 ? "s" : ""}`);
  }

  // Open legal cases flag
  const hasOpenLegalCases = portfolioContext.openLegalCases.length > 0;
  if (hasOpenLegalCases) {
    triggers.push(`Building has ${portfolioContext.openLegalCases.length} active legal case${portfolioContext.openLegalCases.length > 1 ? "s" : ""} — coordinate response with counsel`);
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

  // No access documented warning
  if (exposureLevel === "HIGH" || exposureLevel === "CRITICAL") {
    const hasNoAccessDocs = portfolioContext.recentWorkOrders.length > 0 &&
      !portfolioContext.tenantNotes.some((n) => {
        const text = n.content.toLowerCase();
        return text.includes("access") || text.includes("no answer") || text.includes("refused") || text.includes("entry");
      });
    if (hasNoAccessDocs) {
      triggers.push("WARNING: No access attempts documented — weakens legal defense significantly");
      recommendedActions.push("Document all access attempts with date, time, and method immediately");
    }
  }

  return { exposureLevel, triggers, relevantLaws, recommendedActions, hpdComplaintRisk, isChronicIssue, chronicCount, hasOpenClassC, hasOpenLegalCases };
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
    const emailTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI request timed out after 30s")), 30000)
    );
    const response = await Promise.race([
      anthropic.messages.create({
        model: AI_MODEL,
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
    }),
      emailTimeoutPromise,
    ]);

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    return safeParse<{ subject: string; body: string }>(text) ?? fallback;
  } catch (err: any) {
    console.error("[Themis] Email generation error:", err.message);
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
      console.error("[Themis] Auto-link violations error:", err.message);
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
        sourceType: "themis",
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
        title: `Work order created from Legal Defense: ${draft.title}`,
        relatedRecordType: "WorkOrder",
        relatedRecordId: wo.id,
        buildingId: draft.buildingId,
        createdByUserId: userId,
      },
    });

    return { workOrderId: wo.id };
  });
}
