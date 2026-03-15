import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { promoteDraftToWorkOrder } from "@/lib/services/themis.service";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const result = await promoteDraftToWorkOrder(id, user.id);
  return NextResponse.json(result);
}, "maintenance");
