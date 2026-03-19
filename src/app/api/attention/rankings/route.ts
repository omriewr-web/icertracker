import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { rankTenantsByAttention } from "@/lib/attention/score";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url);
  const buildingId = searchParams.get("buildingId") || undefined;
  const limit = Math.min(50, parseInt(searchParams.get("limit") || "20", 10) || 20);

  const rankings = await rankTenantsByAttention(
    user.organizationId!,
    buildingId,
    limit
  );

  return NextResponse.json({ rankings });
}, "collections");
