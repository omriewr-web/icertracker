import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { assertBuildingAccess } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";
import { promoteDraftToWorkOrder } from "@/lib/services/themis.service";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  // Verify the draft's building belongs to the user's org
  const draft = await prisma.workOrderDraft.findUnique({
    where: { id },
    select: { buildingId: true },
  });
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  const forbidden = await assertBuildingAccess(user, draft.buildingId);
  if (forbidden) return forbidden;

  const result = await promoteDraftToWorkOrder(id, user.id);
  return NextResponse.json(result);
}, "maintenance");
