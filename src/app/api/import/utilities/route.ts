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

  const buildings = await prisma.building.findMany({
    where: { ...orgScope },
    select: { id: true, address: true },
  });
  const buildingMap = new Map(buildings.map((b) => [normalizeAddress(b.address), b.id]));

  let imported = 0, updated = 0, skipped = 0;
  const errors: { row: number; field: string; reason: string }[] = [];
  const matchLog: { row: number; matchedBy: string | null; meterId: string }[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, any>;
    const addr = normalizeAddress(row.buildingAddress || row.serviceAddress || "");
    const buildingId = buildingMap.get(addr);

    if (!buildingId) {
      errors.push({ row: i + 1, field: "buildingAddress", reason: `Building not found: ${row.buildingAddress || row.serviceAddress}` });
      skipped++;
      continue;
    }

    const provider = String(row.provider || "").trim();
    if (!provider) {
      errors.push({ row: i + 1, field: "provider", reason: "Provider is required" });
      skipped++;
      continue;
    }

    const accountNumber = String(row.accountNumber || "").trim();

    if (dryRun) { imported++; continue; }

    try {
      // Find or create meter — match hierarchy: accountNumber > meterNumber+type > unit+type
      let existingMeter: (Awaited<ReturnType<typeof prisma.utilityMeter.findFirst>> & { accounts?: any[] }) | null = null;
      let matchedBy: string | null = null;

      if (accountNumber) {
        const byAccount = await prisma.utilityMeter.findFirst({
          where: { buildingId, accounts: { some: { accountNumber } } },
          include: { accounts: true },
        });
        if (byAccount) { existingMeter = byAccount; matchedBy = "accountNumber"; }
      }

      if (!existingMeter && row.meterNumber) {
        const meterNum = String(row.meterNumber).trim();
        const inferredType = provider.toLowerCase().includes("water") ? "water" : provider.toLowerCase().includes("gas") || provider.toLowerCase().includes("grid") ? "gas" : "electric";
        if (meterNum) {
          const byMeter = await prisma.utilityMeter.findFirst({
            where: { buildingId, meterNumber: meterNum, utilityType: inferredType },
            include: { accounts: true },
          });
          if (byMeter) { existingMeter = byMeter; matchedBy = "meterNumber"; }
        }
      }

      if (!existingMeter && row.unitNumber) {
        const unitNum = String(row.unitNumber).trim();
        const inferredType = provider.toLowerCase().includes("water") ? "water" : provider.toLowerCase().includes("gas") || provider.toLowerCase().includes("grid") ? "gas" : "electric";
        if (unitNum) {
          const unit = await prisma.unit.findFirst({
            where: { buildingId, unitNumber: unitNum },
            select: { id: true },
          });
          if (unit) {
            const byUnit = await prisma.utilityMeter.findFirst({
              where: { buildingId, unitId: unit.id, utilityType: inferredType },
              include: { accounts: true },
            });
            if (byUnit) { existingMeter = byUnit; matchedBy = "unit+type"; }
          }
        }
      }

      if (existingMeter) {
        matchLog.push({ row: i + 1, matchedBy, meterId: existingMeter.id });
        // Update meter
        await prisma.utilityMeter.update({
          where: { id: existingMeter.id },
          data: {
            providerName: provider,
            serviceAddress: row.serviceAddress || existingMeter.serviceAddress,
            notes: row.notes || existingMeter.notes,
          },
        });
        // Upsert account if accountNumber provided
        if (accountNumber && existingMeter.accounts) {
          const existingAccount = existingMeter.accounts.find((a: any) => a.accountNumber === accountNumber);
          if (!existingAccount) {
            await prisma.utilityAccount.create({
              data: { utilityMeterId: existingMeter.id, accountNumber, assignedPartyType: "unknown" },
            });
          }
        }
        updated++;
      } else {
        const meter = await prisma.utilityMeter.create({
          data: {
            buildingId,
            utilityType: provider.toLowerCase().includes("water") ? "water" : provider.toLowerCase().includes("gas") || provider.toLowerCase().includes("grid") ? "gas" : "electric",
            providerName: provider,
            meterNumber: row.meterNumber || undefined,
            serviceAddress: row.serviceAddress || undefined,
            notes: row.notes || undefined,
          },
        });
        if (accountNumber) {
          await prisma.utilityAccount.create({
            data: { utilityMeterId: meter.id, accountNumber, assignedPartyType: "unknown" },
          });
        }
        imported++;
      }
    } catch (err: any) {
      errors.push({ row: i + 1, field: "row", reason: err.message?.slice(0, 200) || "Unknown error" });
      skipped++;
    }
  }

  const importLog = await prisma.importLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      importType: "UTILITIES",
      fileName,
      fileSize: file.size,
      parserUsed: parsed.parserUsed,
      totalRows: parsed.data.length,
      rowsInserted: imported,
      rowsUpdated: updated,
      rowsSkipped: skipped,
      rowsFailed: errors.length,
      rowErrors: errors.length > 0 ? errors : undefined,
      status: dryRun ? "DRY_RUN" : "COMPLETE",
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ imported, updated, skipped, errors, warnings: [], matchLog, importLogId: importLog.id, dryRun });
}, "upload");
