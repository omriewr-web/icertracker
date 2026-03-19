import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { getUtilityTaskDashboardCounts } from "@/lib/utilities/utility-task.service";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const orgId = user.organizationId;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const counts = await getUtilityTaskDashboardCounts(orgId);
  return NextResponse.json(counts);
}, "utilities");
