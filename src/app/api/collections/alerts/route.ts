import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { getCollectionAlerts } from "@/lib/services/collections.service";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  if (user.role === "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const alerts = await getCollectionAlerts(user);
  return NextResponse.json(alerts);
}, "collections");
