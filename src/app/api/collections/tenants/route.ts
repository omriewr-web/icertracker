import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { getARReport } from "@/lib/services/collections.service";
export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const minBalance = url.searchParams.get("minBalance")
    ? Number(url.searchParams.get("minBalance"))
    : undefined;
  const page = url.searchParams.get("page")
    ? Number(url.searchParams.get("page"))
    : 1;
  const pageSize = url.searchParams.get("pageSize")
    ? Number(url.searchParams.get("pageSize"))
    : 50;

  const result = await getARReport(user, {
    buildingId,
    status,
    minBalance,
    page,
    pageSize,
  });

  return NextResponse.json(result);
}, "collections");
