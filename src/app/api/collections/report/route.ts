import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { getFullARReport } from "@/lib/services/collections.service";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId") || undefined;
  const month = url.searchParams.get("month") || undefined;

  const result = await getFullARReport(user, { buildingId, month });
  return NextResponse.json(result);
}, "collections");
