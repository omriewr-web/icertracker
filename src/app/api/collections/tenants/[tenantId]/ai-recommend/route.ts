// AI_GUARDRAIL: This service returns recommendations only.
// It must never directly mutate financial records.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { assertTenantAccess } from "@/lib/data-scope";
import { AI_MODEL } from "@/lib/ai-config";
import { toNumber } from "@/lib/utils/decimal";
import type { AIRecommendation, AIRecommendResponse, AIRecommendFallbackResponse } from "@/lib/collections/types";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are Atlas AI, a collections advisor for a NYC property management company.
You analyze tenant payment data and collection history to recommend the next best actions for the property manager.
Be specific, practical, and prioritized. You understand NYC housing law, rent stabilization, and the legal eviction process.

You MUST return ONLY valid JSON in this exact format, with no extra text before or after:
{
  "recommendations": [
    { "title": "string", "explanation": "string", "urgency": "High" | "Medium" | "Low" }
  ]
}

Provide 3–5 specific recommended actions in priority order.`;

export const GET = withAuth(async (req, { user, params }) => {
  const { tenantId } = await params;

  const denied = await assertTenantAccess(user, tenantId);
  if (denied) return denied;

  // ── Gather context ──

  const [tenant, latestSnapshot, collectionCase, recentNotes, legalCase] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        balance: true,
        legalRent: true,
        collectionScore: true,
        arrearsDays: true,
        leaseExpiration: true,
        leaseStatus: true,
        unit: {
          select: {
            unitNumber: true,
            building: { select: { address: true } },
          },
        },
      },
    }),

    prisma.aRSnapshot.findFirst({
      where: { tenantId },
      orderBy: { snapshotDate: "desc" },
      select: {
        totalBalance: true,
        balance0_30: true,
        balance31_60: true,
        balance61_90: true,
        balance90plus: true,
        collectionStatus: true,
      },
    }),

    prisma.collectionCase.findFirst({
      where: { tenantId, isActive: true },
      select: { status: true },
    }),

    prisma.collectionNote.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { content: true, actionType: true, createdAt: true },
    }),

    prisma.legalCase.findFirst({
      where: { tenantId, isActive: true },
      select: { stage: true, createdAt: true },
    }),
  ]);

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // ── Build context message ──

  const balance = toNumber(tenant.balance);
  const legalRent = toNumber(tenant.legalRent);
  const collectionScore = tenant.collectionScore ?? 0;
  const arrearsDays = tenant.arrearsDays ?? 0;
  const status = collectionCase?.status || latestSnapshot?.collectionStatus || "CURRENT";

  const daysSinceLastNote = recentNotes.length > 0
    ? Math.round((Date.now() - new Date(recentNotes[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : -1;

  const aging = latestSnapshot
    ? `Current $${toNumber(latestSnapshot.balance0_30).toFixed(2)} | 30+ $${toNumber(latestSnapshot.balance31_60).toFixed(2)} | 60+ $${toNumber(latestSnapshot.balance61_90).toFixed(2)} | 90+ $${toNumber(latestSnapshot.balance90plus).toFixed(2)}`
    : "No AR snapshot available";

  const noteLines = recentNotes.length > 0
    ? recentNotes.map((n) =>
        `- ${n.createdAt.toISOString().split("T")[0]} ${n.actionType}: ${n.content}`
      ).join("\n")
    : "No collection notes on record.";

  const userMessage = `Tenant: ${tenant.name}, Unit ${tenant.unit.unitNumber} at ${tenant.unit.building.address}
Total balance: $${balance.toFixed(2)} (${arrearsDays} days outstanding)
Aging: ${aging}
Collection score: ${collectionScore}/100
Status: ${status}
Legal rent: ${legalRent > 0 ? `$${legalRent.toFixed(2)}` : "not set"}
In legal: ${legalCase ? `Yes — stage ${legalCase.stage}, filed ${legalCase.createdAt.toISOString().split("T")[0]}` : "No"}
Recent activity:
${noteLines}
Days since last contact: ${daysSinceLastNote >= 0 ? daysSinceLastNote : "never contacted"}

Based on this information, provide 3–5 specific recommended actions this property manager should take, in priority order.
For each action include: action title, brief explanation, and urgency level (High/Medium/Low).`;

  // ── Call Anthropic ──

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI recommendation unavailable" }, { status: 503 });
    }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "AI recommendation unavailable" }, { status: 503 });
    }

    let raw = textBlock.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const generatedAt = new Date().toISOString();

    // Try parsing as structured recommendations
    try {
      const parsed = JSON.parse(raw);
      const recommendations: AIRecommendation[] = (parsed.recommendations ?? []).map((r: any) => ({
        title: String(r.title ?? ""),
        explanation: String(r.explanation ?? ""),
        urgency: ["High", "Medium", "Low"].includes(r.urgency) ? r.urgency : "Medium",
      }));

      const response: AIRecommendResponse = {
        recommendations,
        generatedAt,
        tenantName: tenant.name,
        totalBalance: balance,
      };
      return NextResponse.json(response);
    } catch {
      // Fallback: return raw text if not parseable as JSON
      const fallback: AIRecommendFallbackResponse = {
        fallback: raw,
        generatedAt,
      };
      return NextResponse.json(fallback);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[AI Recommend] Error:", message);
    return NextResponse.json({ error: "AI recommendation unavailable" }, { status: 503 });
  }
}, "collections");
