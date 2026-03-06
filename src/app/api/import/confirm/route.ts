import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { parsedTenantRowSchema } from "@/lib/validations";
import { fetchBuildingsForMatching, normalizeAddress, extractAddressFromEntity, findMatchingBuilding } from "@/lib/building-matching";
import { saveImportProfile } from "@/lib/importer/matchImportProfile";
import { parseImportFile } from "@/lib/importer/parseFile";
import { analyzeStructure } from "@/lib/importer/analyzeStructure";
import { buildFingerprint } from "@/lib/importer/buildFingerprint";
import { commitRentRollImport } from "@/lib/importer/commit";
import { getImportContract } from "@/lib/importer/importContracts";
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
    select: { id: true, name: true, unitId: true, yardiResidentId: true, unit: { select: { buildingId: true, unitNumber: true } } },
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
      property: propKey, unit, unitType: undefined,
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
        rowIndex: i, raw: raw as any, parsed: raw as any, action: "skip",
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

    // Match tenant by: residentId → buildingId+unit+name
    const normName = name.toLowerCase().trim();
    let matchedTenantId: string | undefined;

    if (raw.residentId) {
      const byYardi = allTenants.find((t) => t.yardiResidentId === raw.residentId);
      if (byYardi) matchedTenantId = byYardi.id;
    }

    if (!matchedTenantId && !buildingId.startsWith("new:")) {
      const match = allTenants.find((t) =>
        t.unit.buildingId === buildingId &&
        t.unit.unitNumber === unit &&
        t.name.toLowerCase().trim() === normName
      );
      if (match) matchedTenantId = match.id;
    }

    // No unitId-only fallback in preview — handled safely in commitRentRollImport

    const action = matchedTenantId ? "update" : "create";
    if (action === "update") updates++;
    else newTenants++;

    parsedRows.push({
      rowIndex: i, raw: raw as any, parsed: raw as any, action,
      matchedTenantId, matchedBuildingId: buildingId,
    });
  }

  return {
    rows: parsedRows,
    summary: { total: parsedRows.length, newTenants, updates, vacancies, errors: errorCount, buildings: [...buildingNames] },
  };
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
  const mode = modeRaw || "stage";

  const contract = getImportContract(fileType ?? "rent_roll");

  // Parse and match all rows
  const { rows, summary } = await parseAndMatchRows(buffer, mapping, dataStartRow);

  // ── STAGING MODE (default for types that require review) ──
  if (mode === "stage" || (mode !== "direct" && contract.requiresReview)) {
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

    return NextResponse.json({ staged: true, stagingId: staging.id, summary });
  }

  // ── DIRECT MODE ──
  const importBatch = await prisma.importBatch.create({
    data: { filename: file.name, format: aiUsed ? "ai-mapped" : "rule-mapped", recordCount: 0, status: "processing" },
  });

  let importRunId: string | undefined;
  try {
    const importRun = await prisma.importRun.create({
      data: {
        organizationId: user.organizationId, fileName: file.name,
        importType: fileType ?? "tenant_list",
        matchedProfileId: matchedProfileId ?? undefined,
        aiUsed, status: "processing",
        analysisJson: { mapping: mapping as any, dataStartRow, fileType } as any,
        finalMappingJson: mapping as any,
        createdById: user.id,
      },
    });
    importRunId = importRun.id;
  } catch { /* non-blocking */ }

  // Use shared commit handler
  const { imported, skipped, errors } = await commitRentRollImport(rows, {
    importBatchId: importBatch.id,
    userId: user.id,
  });

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
          organizationId: user.organizationId, name: `${file.name} (auto-saved)`,
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
