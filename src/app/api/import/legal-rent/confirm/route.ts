import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { canAccessBuilding } from "@/lib/data-scope";

export const dynamic = "force-dynamic";

interface ConfirmRow {
  matchedUnitId: string;
  matchedBuildingId: string;
  legalRent: number | null;
  prefRent: number | null;
  isStabilized: boolean | null;
  dhcrId: string | null;
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const { rows } = (await req.json()) as { rows: ConfirmRow[] };
  if (!rows?.length)
    return NextResponse.json(
      { error: "No rows to import" },
      { status: 400 }
    );

  // Verify all buildings are accessible
  for (const row of rows) {
    if (!(await canAccessBuilding(user, row.matchedBuildingId))) {
      return NextResponse.json(
        { error: "Access denied to one or more buildings" },
        { status: 403 }
      );
    }
  }

  let successCount = 0;
  const errors: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      try {
        // Update Unit
        const unitData: Record<string, unknown> = {};
        if (row.legalRent != null) unitData.legalRent = row.legalRent;
        if (row.isStabilized != null) unitData.rentStabilized = row.isStabilized;
        if (row.dhcrId !== undefined) unitData.dhcrRegistrationId = row.dhcrId;

        if (Object.keys(unitData).length > 0) {
          await tx.unit.update({
            where: { id: row.matchedUnitId },
            data: unitData,
          });
        }

        // Update Tenant preferential rent if present
        if (row.prefRent != null) {
          const tenant = await tx.tenant.findUnique({
            where: { unitId: row.matchedUnitId },
          });
          if (tenant) {
            await tx.tenant.update({
              where: { id: tenant.id },
              data: { prefRent: row.prefRent },
            });
          }
        }

        successCount++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        errors.push(`Unit ${row.matchedUnitId}: ${msg}`);
      }
    }
  });

  return NextResponse.json({
    successCount,
    errorCount: errors.length,
    errors: errors.slice(0, 10),
  });
}, "upload");
