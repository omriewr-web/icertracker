export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { getCollectionsDashboard } from "@/lib/services/collections.service";
import logger from "@/lib/logger";

export const GET = withAuth(async (req, { user }) => {
  const start = Date.now();
  const log = logger.child({ route: "/api/collections/dashboard", userId: user.id });
  log.info({ action: "start" });

  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const result = await getCollectionsDashboard(user, buildingId);

  log.info({ action: "complete", durationMs: Date.now() - start });
  return NextResponse.json(result);
}, "collections");
