import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { updateCollectionStatus } from "@/lib/services/collections.service";
import type { CollectionStatus } from "@prisma/client";

export const PATCH = withAuth(async (req, { user, params }) => {
  const { tenantId } = await params;
  const body = await req.json();

  const { status } = body as { status: CollectionStatus };

  if (!status) {
    return NextResponse.json(
      { error: "status is required" },
      { status: 400 }
    );
  }

  const updated = await updateCollectionStatus(user, tenantId, status);
  return NextResponse.json(updated);
}, "collections");
