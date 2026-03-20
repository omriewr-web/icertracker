import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { parseBuildingDataExcel, buildingRowToPrismaData } from "@/lib/parsers/buildingParser";
import { matchBuildingByRow, generateYardiId, generatePropertyId } from "@/lib/building-matching";
import { startImportLog, completeImportLog } from "@/lib/utils/import-log";
import { getOrgScope } from "@/lib/data-scope";

export const dynamic = "force-dynamic";

// POST /api/import/buildings
// ?mode=preview  → parse file, return preview of what will be created/updated
// ?mode=confirm  → actually import the data
export const POST = withAuth(async (req: NextRequest, { user }) => {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "preview";

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  // File size limit: 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = parseBuildingDataExcel(buffer);

  if (result.buildings.length === 0) {
    return NextResponse.json({
      error: "No building data found in file",
      errors: result.errors,
    }, { status: 400 });
  }

  // Row count limit: 5000
  if (result.buildings.length > 5000) {
    return NextResponse.json({ error: "Too many rows (max 5000)" }, { status: 413 });
  }

  // Load existing buildings for matching (scoped to user's org)
  const existingBuildings = await prisma.building.findMany({
    where: getOrgScope(user),
    select: {
      id: true,
      address: true,
      block: true,
      lot: true,
      yardiId: true,
    },
  });

  interface PreviewRow {
    rowIndex: number;
    address: string;
    buildingId: string;
    action: "create" | "update";
    existingId?: string;
    matchedBy?: string;
  }

  const preview: PreviewRow[] = [];

  for (const row of result.buildings) {
    const match = matchBuildingByRow(row, existingBuildings);
    preview.push({
      rowIndex: row.rowIndex,
      address: row.address,
      buildingId: row.buildingId,
      action: match ? "update" : "create",
      existingId: match?.id,
      matchedBy: match?.matchedBy,
    });
  }

  const toCreate = preview.filter((p) => p.action === "create").length;
  const toUpdate = preview.filter((p) => p.action === "update").length;

  if (mode === "preview") {
    return NextResponse.json({
      format: "building-data",
      total: result.buildings.length,
      toCreate,
      toUpdate,
      preview,
      buildings: result.buildings,
      errors: result.errors,
    });
  }

  // ── Confirm mode: actually import (wrapped in transaction) ──
  const logId = await startImportLog({ userId: user.id, organizationId: user.organizationId, importType: "building-data", fileName: file.name });

  let created = 0;
  let updated = 0;
  const importErrors: string[] = [...result.errors];

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < result.buildings.length; i++) {
      const row = result.buildings[i];
      const previewRow = preview[i];
      const prismaData = buildingRowToPrismaData(row);

      try {
        if (previewRow.action === "update" && previewRow.existingId) {
          await tx.building.update({
            where: { id: previewRow.existingId },
            data: prismaData,
          });
          updated++;
        } else {
          // Use building_id from template as yardiId, or generate one
          const yardiId = row.buildingId || generateYardiId(row.address);
          const propertyId = generatePropertyId(row.address);
          await tx.building.create({
            data: {
              ...prismaData,
              yardiId,
              propertyId,
              address: row.address,
              organizationId: user.organizationId,
            } as any,
          });
          created++;
        }
      } catch (err: any) {
        const detail = err.meta?.target || err.meta?.field_name || "";
        importErrors.push(`Row ${row.rowIndex} (${row.address}): ${err.message}${detail ? ` [field: ${detail}]` : ""}`);
      }
    }
  });

  // Log the import batch
  await prisma.importBatch.create({
    data: {
      filename: file.name,
      format: "building-data",
      recordCount: created + updated,
      status: importErrors.length > 0 ? "completed_with_errors" : "completed",
      errors: importErrors.length > 0 ? importErrors : undefined,
    },
  });

  await completeImportLog(logId, importErrors.length > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED", { rowsInserted: created, rowsUpdated: updated, rowsFailed: importErrors.length, rowErrors: importErrors });

  return NextResponse.json({
    format: "building-data",
    created,
    updated,
    total: result.buildings.length,
    errors: importErrors,
  });
}, "upload");

