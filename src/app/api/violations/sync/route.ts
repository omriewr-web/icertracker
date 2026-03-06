import { NextRequest, NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { violationSyncSchema } from "@/lib/validations";
import { syncBuildingViolations, syncAllBuildings } from "@/lib/violation-sync";
import { assertBuildingAccess } from "@/lib/data-scope";

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const body = await parseBody(req, violationSyncSchema);

  if (body.buildingId) {
    const denied = await assertBuildingAccess(user, body.buildingId);
    if (denied) return denied;
  } else if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let results;
  if (body.buildingId) {
    results = await syncBuildingViolations(body.buildingId, body.sources);
  } else {
    results = await syncAllBuildings(body.sources);
  }

  const totalNew = results.reduce((sum, r) => sum + r.newCount, 0);
  const totalUpdated = results.reduce((sum, r) => sum + r.updatedCount, 0);

  return NextResponse.json({ results, totalNew, totalUpdated });
}, "compliance");
