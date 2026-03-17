import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { canAccessBuilding } from "@/lib/data-scope";
import { z } from "zod";
import type { CollectionActionType } from "@prisma/client";

export const dynamic = "force-dynamic";

const bulkFollowupSchema = z.object({
  tenantIds: z.array(z.string()).min(1).max(200),
  noteText: z.string().min(1).max(2000),
  noteType: z.string().min(1),
});

export const POST = withAuth(async (req, { user }) => {
  const body = await req.json();
  const parsed = bulkFollowupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.errors },
      { status: 400 }
    );
  }

  const { tenantIds, noteText, noteType } = parsed.data;

  // Verify all tenants are in scope
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds }, isDeleted: false },
    select: { id: true, unitId: true, unit: { select: { buildingId: true } } },
  });

  // Check building access for all
  for (const t of tenants) {
    if (!(await canAccessBuilding(user, t.unit.buildingId))) {
      return NextResponse.json(
        { error: "Access denied to one or more tenants" },
        { status: 403 }
      );
    }
  }

  let success = 0;
  const errors: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const t of tenants) {
      try {
        await tx.collectionNote.create({
          data: {
            tenantId: t.id,
            buildingId: t.unit.buildingId,
            authorId: user.id,
            content: noteText,
            actionType: noteType as CollectionActionType,
          },
        });
        success++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        errors.push(`Tenant ${t.id}: ${msg}`);
      }
    }
  });

  return NextResponse.json({
    success,
    failed: errors.length,
    errors: errors.slice(0, 10),
  });
}, "collections");
