import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { routeParser } from "@/lib/parsers/router";
import { normalizeAddress } from "@/lib/building-matching";
import { getOrgScope } from "@/lib/data-scope";
import { checkRowLimit } from "@/lib/importer/validateUpload";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "true";
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file instanceof File ? file.name : "upload.xlsx";
  const parsed = routeParser(buffer, fileName);

  if (!parsed.success || parsed.data.length === 0) {
    return NextResponse.json({ error: "Could not parse file", errors: parsed.errors }, { status: 400 });
  }

  const rowLimitError = checkRowLimit(parsed.data.length);
  if (rowLimitError) return rowLimitError;

  const orgScope = getOrgScope(user);
  const orgId = user.organizationId;

  // Pre-load buildings for address matching
  const buildings = await prisma.building.findMany({
    where: { ...orgScope },
    select: { id: true, address: true },
  });
  const buildingMap = new Map(buildings.map((b) => [normalizeAddress(b.address), b.id]));

  let imported = 0, updated = 0, skipped = 0;
  const errors: { row: number; field: string; reason: string }[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, any>;
    const addr = normalizeAddress(row.buildingAddress || "");
    const buildingId = buildingMap.get(addr);

    if (!buildingId) {
      errors.push({ row: i + 1, field: "buildingAddress", reason: `Building not found: ${row.buildingAddress}` });
      skipped++;
      continue;
    }

    const unitNumber = String(row.unitNumber || "").trim();
    if (!unitNumber) {
      errors.push({ row: i + 1, field: "unitNumber", reason: "Unit number is required" });
      skipped++;
      continue;
    }

    if (dryRun) {
      // Check if exists
      const existing = await prisma.unit.findUnique({ where: { buildingId_unitNumber: { buildingId, unitNumber } } });
      if (existing) updated++;
      else imported++;
      continue;
    }

    try {
      const existing = await prisma.unit.findUnique({ where: { buildingId_unitNumber: { buildingId, unitNumber } } });
      if (existing) {
        await prisma.unit.update({
          where: { id: existing.id },
          data: {
            bedroomCount: row.bedrooms ?? existing.bedroomCount,
            bathroomCount: row.bathrooms ?? existing.bathroomCount,
            squareFeet: row.sqFt ?? existing.squareFeet,
            legalRent: row.legalRent != null ? row.legalRent : existing.legalRent,
            askingRent: row.marketRent != null ? row.marketRent : existing.askingRent,
            rentStabilized: row.rentStabilized ?? existing.rentStabilized,
            isVacant: row.status === "vacant" ? true : row.status === "occupied" ? false : existing.isVacant,
          },
        });
        updated++;
      } else {
        await prisma.unit.create({
          data: {
            buildingId,
            unitNumber,
            bedroomCount: row.bedrooms,
            bathroomCount: row.bathrooms,
            squareFeet: row.sqFt,
            legalRent: row.legalRent,
            askingRent: row.marketRent,
            rentStabilized: row.rentStabilized ?? false,
            isVacant: row.status === "vacant",
          },
        });
        imported++;
      }
    } catch (err: any) {
      errors.push({ row: i + 1, field: "row", reason: err.message?.slice(0, 200) || "Unknown error" });
      skipped++;
    }
  }

  // Create ImportLog
  const importLog = await prisma.importLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      importType: "UNITS",
      fileName,
      fileSize: file.size,
      parserUsed: parsed.parserUsed,
      totalRows: parsed.data.length,
      rowsInserted: imported,
      rowsUpdated: updated,
      rowsSkipped: skipped,
      rowsFailed: errors.length,
      rowErrors: errors.length > 0 ? errors : undefined,
      warningsJson: warnings.length > 0 ? warnings : undefined,
      status: dryRun ? "DRY_RUN" : "COMPLETE",
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ imported, updated, skipped, errors, warnings, importLogId: importLog.id, dryRun });
}, "upload");
