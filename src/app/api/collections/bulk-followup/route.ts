import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { z } from "zod";
import type { CollectionActionType } from "@prisma/client";

export const dynamic = "force-dynamic";

// Roles that have full access to all buildings within their org
const FULL_ORG_ROLES = ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN"];

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

  // Batch building access check — single query instead of N+1
  const uniqueBuildingIds = [...new Set(tenants.map((t) => t.unit.buildingId))];

  if (user.role !== "SUPER_ADMIN") {
    if (FULL_ORG_ROLES.includes(user.role)) {
      if (!user.organizationId) {
        return NextResponse.json(
          { error: "Access denied to one or more tenants" },
          { status: 403 }
        );
      }
      const accessibleCount = await prisma.building.count({
        where: { id: { in: uniqueBuildingIds }, organizationId: user.organizationId },
      });
      if (accessibleCount !== uniqueBuildingIds.length) {
        return NextResponse.json(
          { error: "Access denied to one or more tenants" },
          { status: 403 }
        );
      }
    } else {
      const assigned = user.assignedProperties ?? [];
      const allAccessible = uniqueBuildingIds.every((id) => assigned.includes(id));
      if (!allAccessible) {
        return NextResponse.json(
          { error: "Access denied to one or more tenants" },
          { status: 403 }
        );
      }
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
