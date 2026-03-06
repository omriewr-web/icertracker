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

interface ParsedRow {
  rowIndex: number;
  raw: Record<string, unknown>;
  parsed: {
    property: string;
    unit: string;
    unitType?: string;
    residentId?: string;
    name: string;
    marketRent: number;
    chargeCode?: string;
    chargeAmount: number;
    deposit: number;
    balance: number;
    moveIn?: string;
    leaseExpiration?: string;
    moveOut?: string;
    isVacant: boolean;
  };
  action: "create" | "update" | "vacancy" | "skip";
  matchedTenantId?: string;
  matchedBuildingId?: string;
  error?: string;
}

/**
 * Parse all rows from file+mapping, determine create/update/skip actions.
 * Returns parsed rows with match info for staging or direct import.
 */
async function parseAndMatchRows(
  buffer: Buffer,
  mapping: ColumnMappingEntry[],
  dataStartRow: number,
): Promise<{ rows: ParsedRow[]; summary: { total: number; newTenants: number; updates: number; vacancies: number; errors: number; buildings: string[] } }> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const fieldMap: Record<string, number> = {};
  for (const m of mapping) {
    if (m.mappedField) fieldMap[m.mappedField] = m.columnIndex;
  }
  const get = (row: unknown[], field: string): unknown =>
    fieldMap[field] !== undefined ? row[fieldMap[field]] : undefined;

  const existingBuildings = await fetchBuildingsForMatching();
  const buildingCache = new Map<string, string>();
  const buildingNames = new Set<string>();

  // Pre-fetch all tenants with unit info for matching
  const allTenants = await prisma.tenant.findMany({
    select: { id: true, name: true, unitId: true, unit: { select: { buildingId: true, unitNumber: true } } },
  });

  const parsedRows: ParsedRow[] = [];
  let newTenants = 0;
  let updates = 0;
  let vacancies = 0;
  let errorCount = 0;

  for (let i = dataStartRow - 1; i < rawRows.length; i++) {
    const r = rawRows[i] as unknown[];
    if (!r || r.every((v) => v === "" || v === null || v === undefined)) continue;

    const unit = String(get(r, "unit") ?? "").trim();
    const name = String(get(r, "full_name") ?? "").trim()
      || [String(get(r, "first_name") ?? "").trim(), String(get(r, "last_name") ?? "").trim()].filter(Boolean).join(" ");
    if (!unit && !name) continue;
    if (!unit) {
      parsedRows.push({ rowIndex: i, raw: { unit, name }, parsed: {} as any, action: "skip", error: "Missing unit number" });
      errorCount++;
      continue;
    }

    const isVacant = !name || name.toLowerCase().includes("vacant");
    const propKey = String(get(r, "building_id") ?? "").trim() || "Unknown";

    const raw = {
      property: propKey,
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

    const validated = parsedTenantRowSchema.safeParse(raw);
    if (!validated.success) {
      parsedRows.push({
        rowIndex: i,
        raw: raw as any,
        parsed: raw as any,
        action: "skip",
        error: validated.error.issues.map((issue) => issue.message).join(", "),
      });
      errorCount++;
      continue;
    }

    // Resolve building
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
        // Will be created on commit — use a placeholder for staging
        buildingId = `new:${cacheKey}`;
      }
      buildingCache.set(cacheKey, buildingId);
    }
    buildingNames.add(propKey);

    if (isVacant) {
      parsedRows.push({ rowIndex: i, raw: raw as any, parsed: raw as any, action: "vacancy", matchedBuildingId: buildingId });
      vacancies++;
      continue;
    }

    // Match tenant by: buildingId + unitNumber + normalized name
    const normName = name.toLowerCase().trim();
    let matchedTenantId: string | undefined;

    // First try residentId match
    if (raw.residentId) {
      const byResident = allTenants.find((t) => t.id === raw.residentId);
      // yardiResidentId is unique so use prisma
      const byYardi = await prisma.tenant.findUnique({ where: { yardiResidentId: raw.residentId }, select: { id: true } });
      if (byYardi) matchedTenantId = byYardi.id;
    }

    // Then try buildingId + unit + name composite match
    if (!matchedTenantId && !buildingId.startsWith("new:")) {
      const match = allTenants.find((t) =>
        t.unit.buildingId === buildingId &&
        t.unit.unitNumber === unit &&
        t.name.toLowerCase().trim() === normName
      );
      if (match) matchedTenantId = match.id;
    }

    // Fallback: match by unitId only (existing behavior for same-unit different name = update)
    if (!matchedTenantId && !buildingId.startsWith("new:")) {
      const match = allTenants.find((t) =>
        t.unit.buildingId === buildingId &&
        t.unit.unitNumber === unit
      );
      if (match) matchedTenantId = match.id;
    }

    const action = matchedTenantId ? "update" : "create";
    if (action === "update") updates++;
    else newTenants++;

    parsedRows.push({
      rowIndex: i,
      raw: raw as any,
      parsed: raw as any,
      action,
      matchedTenantId,
      matchedBuildingId: buildingId,
    });
  }

  return {
    rows: parsedRows,
    summary: {
      total: parsedRows.length,
      newTenants,
      updates,
      vacancies,
      errors: errorCount,
      buildings: [...buildingNames],
    },
  };
}

/**
 * Commit parsed rows to DB (called directly or after staging approval).
 */
async function commitRows(
  parsedRows: ParsedRow[],
  importBatchId: string,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const existingBuildings = await fetchBuildingsForMatching();
  const buildingCache = new Map<string, string>();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of parsedRows) {
    if (row.action === "skip") {
      errors.push(`Row ${row.rowIndex + 1}: ${row.error}`);
      skipped++;
      continue;
    }

    const t = row.parsed;
    try {
      // Resolve building (may need to create for new: placeholders)
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
          data: { importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: "UPDATED", entityType: "vacancy", entityId: unitRecord.id },
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
        balance: t.balance, marketRent: t.marketRent, arrearsDays, leaseStatus,
        legalFlag: false, legalRecommended: false, isVacant: false,
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

      // Match by: residentId → buildingId+unit+name → unitId fallback
      if (t.residentId) {
        const existing = await prisma.tenant.findUnique({ where: { yardiResidentId: t.residentId } });
        rowAction = existing ? "UPDATED" : "CREATED";
        tenant = await prisma.tenant.upsert({
          where: { yardiResidentId: t.residentId },
          create: { unitId: unitRecord.id, yardiResidentId: t.residentId, ...tenantData },
          update: tenantData,
        });
      } else {
        // Check buildingId + unit + name match
        const existing = await prisma.tenant.findFirst({
          where: {
            unit: { buildingId, unitNumber: t.unit },
            name: { equals: t.name, mode: "insensitive" },
          },
        });

        if (existing) {
          rowAction = "UPDATED";
          tenant = await prisma.tenant.update({
            where: { id: existing.id },
            data: tenantData,
          });
        } else {
          // Fallback: match by unitId only (one tenant per unit)
          const byUnit = await prisma.tenant.findUnique({ where: { unitId: unitRecord.id } });
          if (byUnit) {
            rowAction = "UPDATED";
            tenant = await prisma.tenant.update({
              where: { id: byUnit.id },
              data: tenantData,
            });
          } else {
            rowAction = "CREATED";
            tenant = await prisma.tenant.create({
              data: { unitId: unitRecord.id, ...tenantData },
            });
          }
        }
      }

      // Dual-write: Lease + BalanceSnapshot
      const normalizedLeaseStatus = leaseExp
        ? (leaseExp < new Date() ? "EXPIRED" : "ACTIVE")
        : "MONTH_TO_MONTH";
      const leaseId = `${tenant.id}-lease`;

      await prisma.lease.upsert({
        where: { id: leaseId },
        create: {
          id: leaseId, unitId: unitRecord.id, tenantId: tenant.id,
          leaseStart: t.moveIn ? new Date(t.moveIn) : null, leaseEnd: leaseExp,
          monthlyRent: t.marketRent, legalRent: 0, preferentialRent: 0,
          securityDeposit: t.deposit, status: normalizedLeaseStatus as any, isStabilized: false,
        },
        update: {
          leaseStart: t.moveIn ? new Date(t.moveIn) : null, leaseEnd: leaseExp,
          monthlyRent: t.marketRent, securityDeposit: t.deposit, status: normalizedLeaseStatus as any,
        },
      });

      await prisma.balanceSnapshot.create({
        data: {
          tenantId: tenant.id, leaseId, importBatchId,
          snapshotDate: new Date(),
          currentCharges: t.chargeAmount || t.marketRent,
          currentBalance: t.balance,
          pastDueBalance: t.balance > 0 ? t.balance : 0,
          arrearsStatus: arrearsCategory,
        },
      });

      await prisma.importRow.create({
        data: { importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: rowAction, entityType: "tenant", entityId: tenant.id },
      });

      imported++;
    } catch (e: any) {
      errors.push(`${t.unit} ${t.name}: ${e.message}`);
      await prisma.importRow.create({
        data: { importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: "ERROR", entityType: "tenant", errors: [e.message] },
      }).catch(() => {});
      skipped++;
    }
  }

  return { imported, skipped, errors };
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const columnMappingRaw = formData.get("columnMapping") as string | null;
  const dataStartRowRaw = formData.get("dataStartRow") as string | null;
  const fileType = formData.get("fileType") as string | null;
  const matchedProfileId = formData.get("matchedProfileId") as string | null;
  const aiUsedRaw = formData.get("aiUsed") as string | null;
  const modeRaw = formData.get("mode") as string | null;

  if (!file || !columnMappingRaw || !dataStartRowRaw) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mapping: ColumnMappingEntry[] = JSON.parse(columnMappingRaw);
  const dataStartRow = parseInt(dataStartRowRaw, 10);
  const aiUsed = aiUsedRaw === "true";
  const mode = modeRaw || "stage"; // "stage" (default) or "direct"

  // Parse and match all rows
  const { rows, summary } = await parseAndMatchRows(buffer, mapping, dataStartRow);

  // ── STAGING MODE (default) ──────────────────────────────────────
  if (mode === "stage") {
    const staging = await prisma.importStagingBatch.create({
      data: {
        importType: fileType ?? "tenant_list",
        fileName: file.name,
        uploadedById: user.id,
        status: "pending_review",
        rowsJson: rows as any,
        mappingJson: mapping as any,
        summaryJson: summary as any,
      },
    });

    return NextResponse.json({
      staged: true,
      stagingId: staging.id,
      summary,
    });
  }

  // ── DIRECT MODE (skip staging) ──────────────────────────────────
  const importBatch = await prisma.importBatch.create({
    data: { filename: file.name, format: aiUsed ? "ai-mapped" : "rule-mapped", recordCount: 0, status: "processing" },
  });

  let importRunId: string | undefined;
  try {
    const importRun = await prisma.importRun.create({
      data: {
        organizationId: "default", fileName: file.name,
        importType: fileType ?? "tenant_list",
        matchedProfileId: matchedProfileId ?? undefined,
        aiUsed, status: "processing",
        analysisJson: { mapping: mapping as any, dataStartRow, fileType } as any,
        finalMappingJson: mapping as any,
      },
    });
    importRunId = importRun.id;
  } catch { /* non-blocking */ }

  const { imported, skipped, errors } = await commitRows(rows, importBatch.id);

  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: {
      recordCount: imported,
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  if (importRunId) {
    try {
      await prisma.importRun.update({
        where: { id: importRunId },
        data: { status: errors.length > 0 ? "completed_with_errors" : "completed" },
      });
    } catch { /* non-blocking */ }
  }

  // Save import profile
  let profileSaved = false;
  if (imported > 0) {
    try {
      const parsed = parseImportFile(buffer, file.name);
      const sheetData = parsed.sheets[0];
      if (sheetData) {
        const structure = analyzeStructure(sheetData);
        const fingerprint = buildFingerprint(sheetData, structure);
        const profileMapping = mapping.map((m) => ({
          columnIndex: m.columnIndex, sourceHeader: m.sourceHeader,
          normalizedHeader: m.sourceHeader.toLowerCase().trim(),
          mappedField: m.mappedField, confidence: m.confidence,
          reason: "Confirmed by user", method: (m.method ?? "alias") as any,
        }));
        await saveImportProfile({
          organizationId: "default", name: `${file.name} (auto-saved)`,
          importType: fileType ?? "tenant_list", sheetNamePattern: sheetData.sheetName,
          headerRowCount: structure.headerRows.length, fingerprint, mapping: profileMapping,
        });
        profileSaved = true;
      }
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({
    imported, skipped, errors, total: imported + skipped,
    format: aiUsed ? "ai-mapped" : "rule-mapped",
    batchId: importBatch.id, profileSaved,
  });
}, "upload");
