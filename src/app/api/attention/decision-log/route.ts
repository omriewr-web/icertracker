import { NextRequest, NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api-helpers";
import {
  logRecommendationShown,
  recordDecisionOutcome,
  getRecommendationStats,
} from "@/lib/attention/decision-log";
import { z } from "zod";

export const dynamic = "force-dynamic";

const logSchema = z.object({
  module: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  recommendationCode: z.string(),
  recommendationText: z.string(),
  severity: z.string(),
});

const outcomeSchema = z.object({
  logId: z.string(),
  outcome: z.enum(["acted", "overridden", "dismissed"]),
  userAction: z.string().optional(),
});

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url);
  const mod = searchParams.get("module") || undefined;
  const stats = await getRecommendationStats(user.organizationId!, mod);
  return NextResponse.json({ stats });
}, "dash");

export const POST = withAuth(async (req, { user }) => {
  const body = await req.json();

  // Log a new recommendation shown
  if (body.action === "log_shown") {
    const data = logSchema.parse(body);
    const logId = await logRecommendationShown({
      orgId: user.organizationId!,
      userId: user.id,
      ...data,
    });
    return NextResponse.json({ logId });
  }

  // Record outcome
  if (body.action === "record_outcome") {
    const data = outcomeSchema.parse(body);
    await recordDecisionOutcome(data.logId, data.outcome, data.userAction);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}, "dash");
