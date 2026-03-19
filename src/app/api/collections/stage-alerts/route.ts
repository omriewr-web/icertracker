import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { getOverdueAlerts } from "@/lib/collections/collectionsStageService";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  if (user.role === "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!user.organizationId) return NextResponse.json({ error: "Organization not configured" }, { status: 401 });
  const alerts = await getOverdueAlerts(user.organizationId);
  return NextResponse.json(alerts);
}, "collections");
