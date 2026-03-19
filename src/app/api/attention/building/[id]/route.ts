import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { computeBuildingAttention } from "@/lib/attention/score";
import { canAccessBuilding } from "@/lib/data-scope";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  if (!(await canAccessBuilding(user, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const score = await computeBuildingAttention(id, user.organizationId!);
  return NextResponse.json(score);
}, "dash");
