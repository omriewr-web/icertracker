export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { getCollectionsDashboard } from "@/lib/services/collections.service";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const result = await getCollectionsDashboard(user, buildingId);
  return NextResponse.json(result);
}, "collections");
