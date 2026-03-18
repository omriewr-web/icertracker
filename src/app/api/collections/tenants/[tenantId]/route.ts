import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { getTenantCollectionProfile } from "@/lib/services/collections.service";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  if (user.role === "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId } = await params;

  const result = await getTenantCollectionProfile(user, tenantId);
  return NextResponse.json(result);
}, "collections");
