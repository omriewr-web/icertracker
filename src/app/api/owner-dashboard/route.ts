import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { getOwnerDashboard } from "@/lib/services/owner-dashboard.service";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const data = await getOwnerDashboard(user);
  return NextResponse.json(data);
}, "owner");
