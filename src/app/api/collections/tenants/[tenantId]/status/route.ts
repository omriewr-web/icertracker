import { NextRequest, NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { updateCollectionStatus } from "@/lib/services/collections.service";
import { collectionStatusUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const PATCH = withAuth(async (req, { user, params }) => {
  const { tenantId } = await params;
  const { status } = await parseBody(req, collectionStatusUpdateSchema);

  const updated = await updateCollectionStatus(user, tenantId, status as any);
  return NextResponse.json(updated);
}, "collections");
