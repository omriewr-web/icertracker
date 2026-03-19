import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import {
  getTenantActionCards,
  getBuildingActionCards,
  getWorkOrderActionCards,
} from "@/lib/attention/action-cards";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { entityType, entityId } = await params;

  let cards;
  if (entityType === "tenant") {
    cards = await getTenantActionCards(entityId, user.organizationId!);
  } else if (entityType === "building") {
    cards = await getBuildingActionCards(entityId, user.organizationId!);
  } else if (entityType === "work_order") {
    cards = await getWorkOrderActionCards(entityId, user.organizationId!);
  } else {
    return NextResponse.json({ error: "Unsupported entity type" }, { status: 400 });
  }

  return NextResponse.json({ cards });
}, "dash");
