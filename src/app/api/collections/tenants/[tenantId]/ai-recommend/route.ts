import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { assertTenantAccess } from "@/lib/data-scope";
import { AI_MODEL } from "@/lib/ai-config";
import { toNumber } from "@/lib/utils/decimal";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are a collections advisor for a NYC property management company. Analyze this tenant's data and return ONLY valid JSON with no extra text:
{ "riskScore": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "recommendedAction": "string", "suggestedFollowUpDays": number, "draftNote": "string", "reasoning": "string" }`;

export const GET = withAuth(async (req, { user, params }) => {
  const { tenantId } = await params;

  const denied = await assertTenantAccess(user, tenantId);
  if (denied) return denied;

  // ── Gather context ──

  const [tenant, latestSnapshot, snapshotTrend, recentNotes, legalCase] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        balance: true,
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
        snapshotDate: true,
      },
    }),

    prisma.aRSnapshot.findMany({
      where: { tenantId },
      orderBy: { snapshotDate: "desc" },
      take: 6,
      select: { totalBalance: true, month: true },
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

  // ── Build user message ──

  const context = [
    `Tenant: ${tenant.name}`,
    `Unit: ${tenant.unit.unitNumber}, Building: ${tenant.unit.building.address}`,
    `Current Balance: $${toNumber(tenant.balance).toFixed(2)}`,
    `Lease Status: ${tenant.leaseStatus}`,
    `Lease Expiration: ${tenant.leaseExpiration?.toISOString().split("T")[0] ?? "Unknown"}`,
  ];

  if (latestSnapshot) {
    context.push(
      `\nLatest AR Snapshot (${latestSnapshot.snapshotDate.toISOString().split("T")[0]}):`,
      `  Collection Status: ${latestSnapshot.collectionStatus}`,
      `  Total Balance: $${toNumber(latestSnapshot.totalBalance).toFixed(2)}`,
      `  0-30 days: $${toNumber(latestSnapshot.balance0_30).toFixed(2)}`,
      `  31-60 days: $${toNumber(latestSnapshot.balance31_60).toFixed(2)}`,
      `  61-90 days: $${toNumber(latestSnapshot.balance61_90).toFixed(2)}`,
      `  90+ days: $${toNumber(latestSnapshot.balance90plus).toFixed(2)}`,
    );
  }

  if (snapshotTrend.length > 0) {
    context.push(`\nBalance Trend (last ${snapshotTrend.length} months):`);
    for (const s of snapshotTrend.reverse()) {
      context.push(`  ${s.month.toISOString().split("T")[0]}: $${toNumber(s.totalBalance).toFixed(2)}`);
    }
  }

  if (recentNotes.length > 0) {
    context.push(`\nLast ${recentNotes.length} Collection Notes:`);
    for (const n of recentNotes) {
      context.push(`  [${n.createdAt.toISOString().split("T")[0]}] ${n.actionType}: ${n.content}`);
    }
  } else {
    context.push("\nNo collection notes on record.");
  }

  if (legalCase) {
    context.push(`\nActive Legal Case: Stage=${legalCase.stage}, Filed=${legalCase.createdAt.toISOString().split("T")[0]}`);
  }

  const userMessage = context.join("\n");

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
      max_tokens: 600,
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

    const result = JSON.parse(raw);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[AI Recommend] Error:", err.message);
    return NextResponse.json({ error: "AI recommendation unavailable" }, { status: 503 });
  }
}, "collections");
