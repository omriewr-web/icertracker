import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { parsedTenantRowSchema } from "@/lib/validations";
import { getArrearsCategory, getArrearsDays, getLeaseStatus, calcCollectionScore } from "@/lib/scoring";
import { findMatchingBuilding, fetchBuildingsForMatching, generateYardiId, normalizeAddress, extractAddressFromEntity } from "@/lib/building-matching";
import { saveImportProfile } from "@/lib/importer/matchImportProfile";
import { parseImportFile } from "@/lib/importer/parseFile";
import { analyzeStructure } from "@/lib/importer/analyzeStructure";
import { buildFingerprint } from "@/lib/importer/buildFingerprint";
import { validateImportRows, transformRows } from "@/lib/importer/validateImportRows";
import * as XLSX from "xlsx";

interface ColumnMappingEntry {
  columnIndex: number;
  sourceHeader: string;
  mappedField: string | null;
  confidence: number;
  method?: string;
}

function numVal(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v.replace(/[$,]/g, "")) : Number(v);
  return isNaN(n) ? 0 : n;
}

function dateVal(v: unknown): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString().split("T")[0];
  if (typeof v === "number" && v > 30000 && v < 60000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const parsed = new Date(v as string);
  return isNaN(parsed.getTime()) ? undefined : parsed.toISOString().split("T")[0];
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const columnMappingRaw = formData.get("columnMapping") as string | null;
  const dataStartRowRaw = formData.get("dataStartRow") as string | null;
  const fileType = formData.get("fileType") as string | null;
  const matchedProfileId = formData.get("matchedProfileId") as string | null;
  const aiUsedRaw = formData.get("aiUsed") as string | null;

  if (!file || !columnMappingRaw || !dataStartRowRaw) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mapping: ColumnMappingEntry[] = JSON.parse(columnMappingRaw);
  const dataStartRow = parseInt(dataStartRowRaw, 10);
  const aiUsed = aiUsedRaw === "true";

  // Parse and validate rows
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  // Build field → column index map
  const fieldMap: Record<string, number> = {};
  for (const m of mapping) {
    if (m.mappedField) fieldMap[m.mappedField] = m.columnIndex;
  }

  const get = (row: unknown[], field: string): unknown =>
    fieldMap[field] !== undefined ? row[fieldMap[field]] : undefined;

  // Create import batch
  const importBatch = await prisma.importBatch.create({
    data: {
      filename: file.name,
      format: aiUsed ? "ai-mapped" : "rule-mapped",
      recordCount: 0,
      status: "processing",
    },
  });

  // Create ImportRun to track this import
  let importRunId: string | undefined;
  try {
    const importRun = await prisma.importRun.create({
      data: {
        organizationId: "default",
        fileName: file.name,
        importType: fileType ?? "tenant_list",
        matchedProfileId: matchedProfileId ?? undefined,
        aiUsed,
        status: "processing",
        analysisJson: { mapping: mapping as any, dataStartRow, fileType } as any,
        finalMappingJson: mapping as any,
      },
    });
    importRunId = importRun.id;
  } catch {
    // ImportRun table might not exist yet — non-blocking
  }

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;
  const buildingCache = new Map<string, string>();
  const existingBuildings = await fetchBuildingsForMatching();

  for (let i = dataStartRow - 1; i < rawRows.length; i++) {
    const r = rawRows[i] as unknown[];
    if (!r || r.every((v) => v === "" || v === null || v === undefined)) continue;

    const unit = String(get(r, "unit") ?? "").trim();
    const name = String(get(r, "full_name") ?? "").trim()
      || [String(get(r, "first_name") ?? "").trim(), String(get(r, "last_name") ?? "").trim()].filter(Boolean).join(" ");
    if (!unit && !name) continue;
    if (!unit) {
      errors.push(`Row ${i + 1}: missing unit number`);
      skipped++;
      continue;
    }

    const isVacant = !name || name.toLowerCase().includes("vacant");

    const raw = {
      property: String(get(r, "building_id") ?? "").trim(),
      unit,
      unitType: undefined,
      residentId: String(get(r, "tenant_code") ?? "").trim() || undefined,
      name: isVacant ? "VACANT" : name,
      marketRent: numVal(get(r, "market_rent") || get(r, "monthly_rent")),
      chargeCode: undefined,
      chargeAmount: numVal(get(r, "monthly_rent") || get(r, "market_rent")),
      charges: [],
      deposit: numVal(get(r, "security_deposit")),
      balance: numVal(get(r, "current_balance")),
      moveIn: dateVal(get(r, "move_in_date") || get(r, "lease_start_date")),
      leaseExpiration: dateVal(get(r, "lease_end_date")),
      moveOut: dateVal(get(r, "move_out_date")),
      isVacant,
    };

    const parsed = parsedTenantRowSchema.safeParse(raw);
    if (!parsed.success) {
      const rowErrors = parsed.error.issues.map((issue) => issue.message);
      errors.push(`${raw.unit} ${raw.name}: validation failed – ${rowErrors.join(", ")}`);
      await prisma.importRow.create({
        data: {
          importBatchId: importBatch.id,
          rowIndex: i,
          rawData: raw as any,
          status: "ERROR",
          entityType: "tenant",
          errors: rowErrors,
        },
      });
      skipped++;
      continue;
    }

    const t = parsed.data;
    try {
      const propKey = t.property || "Unknown";
      const yardiMatch = propKey.match(/\(([^)]+)\)\s*$/);
      const yardiCode = yardiMatch ? yardiMatch[1] : null;
      const extractedAddr = extractAddressFromEntity(propKey);
      const cacheKey = normalizeAddress(extractedAddr || propKey);
      let buildingId = buildingCache.get(cacheKey);

      if (!buildingId) {
        const match = findMatchingBuilding(
          { address: extractedAddr || propKey, block: null, lot: null, entity: propKey, yardiId: yardiCode },
          existingBuildings,
        );
        if (match) {
          buildingId = match.id;
        } else {
          const yardiId = generateYardiId(propKey);
          const building = await prisma.building.create({
            data: { yardiId, address: propKey },
          });
          buildingId = building.id;
          existingBuildings.push({ id: buildingId, address: propKey, block: null, lot: null, entity: null, yardiId });
        }
        buildingCache.set(cacheKey, buildingId);
      }

      const unitRecord = await prisma.unit.upsert({
        where: { buildingId_unitNumber: { buildingId, unitNumber: t.unit } },
        create: { buildingId, unitNumber: t.unit, unitType: t.unitType, isVacant: t.isVacant },
        update: { unitType: t.unitType, isVacant: t.isVacant },
      });

      if (t.isVacant) {
        await prisma.vacancyInfo.upsert({
          where: { unitId: unitRecord.id },
          create: { unitId: unitRecord.id, proposedRent: t.marketRent },
          update: { proposedRent: t.marketRent },
        });
        await prisma.importRow.create({
          data: {
            importBatchId: importBatch.id,
            rowIndex: i,
            rawData: raw as any,
            status: "UPDATED",
            entityType: "vacancy",
            entityId: unitRecord.id,
          },
        });
        imported++;
        continue;
      }

      const leaseExp = t.leaseExpiration ? new Date(t.leaseExpiration) : null;
      const arrearsCategory = getArrearsCategory(t.balance, t.marketRent);
      const arrearsDays = getArrearsDays(t.balance, t.marketRent);
      const leaseStatus = getLeaseStatus(leaseExp);
      const monthsOwed = t.marketRent > 0 ? t.balance / t.marketRent : 0;

      const collectionScore = calcCollectionScore({
        balance: t.balance,
        marketRent: t.marketRent,
        arrearsDays,
        leaseStatus,
        legalFlag: false,
        legalRecommended: false,
        isVacant: false,
      });

      const tenantData = {
        name: t.name,
        marketRent: t.marketRent,
        chargeCode: t.chargeCode,
        actualRent: t.chargeAmount || t.marketRent,
        deposit: t.deposit,
        balance: t.balance,
        moveInDate: t.moveIn ? new Date(t.moveIn) : null,
        leaseExpiration: leaseExp,
        moveOutDate: t.moveOut ? new Date(t.moveOut) : null,
        arrearsCategory,
        arrearsDays,
        monthsOwed,
        leaseStatus,
        collectionScore,
      };

      let tenant;
      let rowAction: "CREATED" | "UPDATED";
      if (t.residentId) {
        const existing = await prisma.tenant.findUnique({ where: { yardiResidentId: t.residentId } });
        rowAction = existing ? "UPDATED" : "CREATED";
        tenant = await prisma.tenant.upsert({
          where: { yardiResidentId: t.residentId },
          create: { unitId: unitRecord.id, yardiResidentId: t.residentId, ...tenantData },
          update: tenantData,
        });
      } else {
        const existing = await prisma.tenant.findUnique({ where: { unitId: unitRecord.id } });
        rowAction = existing ? "UPDATED" : "CREATED";
        tenant = await prisma.tenant.upsert({
          where: { unitId: unitRecord.id },
          create: { unitId: unitRecord.id, ...tenantData },
          update: tenantData,
        });
      }

      // Dual-write: Lease + BalanceSnapshot
      const normalizedLeaseStatus = leaseExp
        ? (leaseExp < new Date() ? "EXPIRED" : "ACTIVE")
        : "MONTH_TO_MONTH";

      const leaseId = `${tenant.id}-lease`;

      await prisma.lease.upsert({
        where: { id: leaseId },
        create: {
          id: leaseId,
          unitId: unitRecord.id,
          tenantId: tenant.id,
          leaseStart: t.moveIn ? new Date(t.moveIn) : null,
          leaseEnd: leaseExp,
          monthlyRent: t.marketRent,
          legalRent: 0,
          preferentialRent: 0,
          securityDeposit: t.deposit,
          status: normalizedLeaseStatus as any,
          isStabilized: false,
        },
        update: {
          leaseStart: t.moveIn ? new Date(t.moveIn) : null,
          leaseEnd: leaseExp,
          monthlyRent: t.marketRent,
          securityDeposit: t.deposit,
          status: normalizedLeaseStatus as any,
        },
      });

      await prisma.balanceSnapshot.create({
        data: {
          tenantId: tenant.id,
          leaseId,
          importBatchId: importBatch.id,
          snapshotDate: new Date(),
          currentCharges: t.chargeAmount || t.marketRent,
          currentBalance: t.balance,
          pastDueBalance: t.balance > 0 ? t.balance : 0,
          arrearsStatus: arrearsCategory,
        },
      });

      await prisma.importRow.create({
        data: {
          importBatchId: importBatch.id,
          rowIndex: i,
          rawData: raw as any,
          status: rowAction,
          entityType: "tenant",
          entityId: tenant.id,
        },
      });

      imported++;
    } catch (e: any) {
      errors.push(`${t.unit} ${t.name}: ${e.message}`);
      await prisma.importRow.create({
        data: {
          importBatchId: importBatch.id,
          rowIndex: i,
          rawData: raw as any,
          status: "ERROR",
          entityType: "tenant",
          errors: [e.message],
        },
      }).catch(() => {});
      skipped++;
    }
  }

  // Update batch with final counts
  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: {
      recordCount: imported,
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  // Update ImportRun status
  if (importRunId) {
    try {
      await prisma.importRun.update({
        where: { id: importRunId },
        data: { status: errors.length > 0 ? "completed_with_errors" : "completed" },
      });
    } catch {
      // Non-blocking
    }
  }

  // Save import profile for future matching
  let profileSaved = false;
  if (imported > 0) {
    try {
      const parsed = parseImportFile(buffer, file.name);
      const sheetData = parsed.sheets[0];
      if (sheetData) {
        const structure = analyzeStructure(sheetData);
        const fingerprint = buildFingerprint(sheetData, structure);
        const profileMapping = mapping.map((m) => ({
          columnIndex: m.columnIndex,
          sourceHeader: m.sourceHeader,
          normalizedHeader: m.sourceHeader.toLowerCase().trim(),
          mappedField: m.mappedField,
          confidence: m.confidence,
          reason: "Confirmed by user",
          method: (m.method ?? "alias") as any,
        }));

        await saveImportProfile({
          organizationId: "default",
          name: `${file.name} (auto-saved)`,
          importType: fileType ?? "tenant_list",
          sheetNamePattern: sheetData.sheetName,
          headerRowCount: structure.headerRows.length,
          fingerprint,
          mapping: profileMapping,
        });
        profileSaved = true;
      }
    } catch {
      // Profile save is optional — don't fail the import
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    errors,
    total: imported + skipped,
    format: aiUsed ? "ai-mapped" : "rule-mapped",
    batchId: importBatch.id,
    profileSaved,
  });
}, "upload");
