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
import { startImportLog, completeImportLog } from "@/lib/utils/import-log";

export const dynamic = "force-dynamic";

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

const YARDI_CODE_RE = /^t\d{4,}$/i;
const YARDI_ENTITY_RE = /([^(]+)\(([A-Za-z0-9]{2,20})\)\s*$/;

/**
 * Scan raw rows for Yardi building entity markers.
 * Yardi rent rolls embed building info in Total/entity rows like:
 *   "Icer of 993 Summit Ave LLC(993sum)"
 *   "Total for Some Entity(code123)"
 * Returns an array of { rowIndex, entityName, yardiCode } sorted by rowIndex.
 */
function detectBuildingSections(rawRows: unknown[][]): { rowIndex: number; entityName: string; yardiCode: string }[] {
  const sections: { rowIndex: number; entityName: string; yardiCode: string }[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i] as unknown[];
    if (!r) continue;
    const firstCell = String(r[0] ?? "").trim();
    if (!firstCell) continue;
    // Strip "Total for " prefix if present
    const cleaned = firstCell.replace(/^Total\s+(for\s+)?/i, "");
    const match = cleaned.match(YARDI_ENTITY_RE);
    if (match) {
      sections.push({ rowIndex: i, entityName: firstCell, yardiCode: match[2] });
    }
  }
  return sections;
}

/**
 * Assign a building entity to each data row based on detected sections.
 * Yardi Total/entity rows appear AFTER the data rows they summarize,
 * so each data row belongs to the next entity row below it.
 */
function buildRowToBuildingMap(
  sections: { rowIndex: number; entityName: string; yardiCode: string }[],
  dataStartRow: number,
  totalRows: number,
): Map<number, { entityName: string; yardiCode: string }> {
  const map = new Map<number, { entityName: string; yardiCode: string }>();
  if (sections.length === 0) return map;

  if (sections.length === 1) {
    // Single building: apply to ALL data rows
    const entity = sections[0];
    for (let i = dataStartRow; i < totalRows; i++) {
      map.set(i, entity);
    }
    return map;
  }

  // Multi-building: each data row belongs to the next entity row below it
  for (let i = dataStartRow; i < totalRows; i++) {
    const owningSection = sections.find((s) => s.rowIndex >= i);
    if (owningSection) {
      map.set(i, owningSection);
    } else {
      // Rows after the last entity row: use the last section
      map.set(i, sections[sections.length - 1]);
    }
  }
  return map;
}

/**
 * Parse all rows from file+mapping, determine create/update/skip actions.
 */
async function parseAndMatchRows(
  buffer: Buffer,
  mapping: ColumnMappingEntry[],
  dataStartRow: number,
  organizationId?: string | null,
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
  const mappedColIndices = new Set(Object.values(fieldMap));

  // ── Detect building sections from Yardi Total/entity rows ──
  const buildingSections = detectBuildingSections(rawRows);
  const rowToBuilding = buildRowToBuildingMap(buildingSections, dataStartRow - 1, rawRows.length);

  const existingBuildings = await fetchBuildingsForMatching(organizationId);
  const buildingCache = new Map<string, string>();
  const buildingNames = new Set<string>();

  // Pre-fetch tenants scoped to matched buildings for matching
  const matchedBuildingIds = existingBuildings.map((b) => b.id);
  const allTenants = await prisma.tenant.findMany({
    where: { unit: { buildingId: { in: matchedBuildingIds } } },
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
    let name = String(get(r, "full_name") ?? "").trim()
      || [String(get(r, "first_name") ?? "").trim(), String(get(r, "last_name") ?? "").trim()].filter(Boolean).join(" ");
    let residentIdOverride: string | undefined;

    // ── Yardi name fix: if name looks like a tenant code (t0011687), swap it ──
    if (YARDI_CODE_RE.test(name)) {
      residentIdOverride = name;
      name = "";
      // Try to find the actual name from sub-rows (Yardi puts name on continuation rows)
      const nameColIdx = fieldMap["full_name"];
      if (nameColIdx !== undefined) {
        for (let j = i + 1; j < Math.min(i + 5, rawRows.length); j++) {
          const nextRow = rawRows[j] as unknown[];
          if (!nextRow) continue;
          const nextUnit = String(nextRow[fieldMap["unit"] ?? -1] ?? "").trim();
          if (nextUnit && nextUnit !== unit) break; // hit next unit
          const candidate = String(nextRow[nameColIdx] ?? "").trim();
          if (candidate && !YARDI_CODE_RE.test(candidate) && /[a-zA-Z]{2,}/.test(candidate)) {
            name = candidate;
            break;
          }
        }
      }
      // Fallback: scan unmapped columns in current row for a name-like value
      if (!name) {
        for (let col = 0; col < r.length; col++) {
          if (mappedColIndices.has(col)) continue;
          const val = String(r[col] ?? "").trim();
          if (val && /^[A-Za-z][A-Za-z\s,.'-]{2,}$/.test(val) && val.length >= 3 && val.length <= 80) {
            name = val;
            break;
          }
        }
      }
    }

    if (!unit && !name) continue;
    if (!unit) {
      parsedRows.push({ rowIndex: i, raw: { unit, name }, parsed: {} as any, action: "skip", error: "Missing unit number" });
      errorCount++;
      continue;
    }

    // If we have a residentId but no name, use the code as fallback name (not vacant)
    if (!name && residentIdOverride) {
      name = residentIdOverride;
    }
    const isVacant = !name || name.toLowerCase().includes("vacant");

    // ── Resolve building: prefer detected Yardi section, then mapped column ──
    const sectionBuilding = rowToBuilding.get(i);
    const propKey = sectionBuilding
      ? sectionBuilding.entityName
      : (String(get(r, "building_id") ?? "").trim() || "Unknown");

    const raw = {
      property: propKey, unit, unitType: undefined,
      residentId: residentIdOverride || String(get(r, "tenant_code") ?? "").trim() || undefined,
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
    // Use the extracted address or entity name for display, not the raw entity+code string
    const displayAddr = extractAddressFromEntity(propKey) || propKey;
    buildingNames.add(displayAddr);

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

  // File size limit: 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let mapping: ColumnMappingEntry[];
  try {
    mapping = JSON.parse(columnMappingRaw);
  } catch {
    return NextResponse.json({ error: "Invalid columnMapping: must be valid JSON" }, { status: 400 });
  }
  const dataStartRow = parseInt(dataStartRowRaw, 10);
  const aiUsed = aiUsedRaw === "true";
  const mode = modeRaw || "stage";

  const contract = getImportContract(fileType ?? "rent_roll");

  // Parse and match all rows
  const { rows, summary } = await parseAndMatchRows(buffer, mapping, dataStartRow, user.organizationId);

  // Row count limit: 5000
  if (rows.length > 5000) {
    return NextResponse.json({ error: "Too many rows (max 5000)" }, { status: 413 });
  }

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

    return NextResponse.json({
      staged: true, stagingId: staging.id, summary,
      diagnostics: {
        analyzedRows: summary.total,
        newTenants: summary.newTenants,
        updates: summary.updates,
        vacancies: summary.vacancies,
        parseErrors: summary.errors,
        buildingsDetected: summary.buildings,
        aiUsed,
        profileUsed: !!matchedProfileId,
        mode: "stage",
      },
    });
  }

  // ── DIRECT MODE ──
  const importBatch = await prisma.importBatch.create({
    data: { filename: file.name, format: aiUsed ? "ai-mapped" : "rule-mapped", recordCount: 0, status: "processing" },
  });

  const logId = await startImportLog({ userId: user.id, organizationId: user.organizationId, importType: fileType ?? "tenant_list", fileName: file.name });

  let importRunId: string | undefined;
  try {
    const importRun = await prisma.importRun.create({
      data: {
        organizationId: user.organizationId ?? undefined, fileName: file.name,
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

  let imported = 0;
  let skipped = 0;
  let errors: string[] = [];
  let profileSaved = false;

  try {
    // Use shared commit handler
    const result = await commitRentRollImport(rows, {
      importBatchId: importBatch.id,
      userId: user.id,
      organizationId: user.organizationId,
    });
    imported = result.imported;
    skipped = result.skipped;
    errors = result.errors;

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

    await completeImportLog(logId, errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED", { rowsInserted: imported, rowsFailed: skipped, rowErrors: errors });

    // Save import profile
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
  } catch (err) {
    await prisma.importBatch.update({
      where: { id: importBatch.id },
      data: { status: "failed", errors: [err instanceof Error ? err.message : "Unknown error"] },
    });

    if (importRunId) {
      try {
        await prisma.importRun.update({
          where: { id: importRunId },
          data: { status: "failed" },
        });
      } catch { /* non-blocking */ }
    }

    await completeImportLog(logId, "FAILED", { rowErrors: [err instanceof Error ? err.message : "Unknown error"] });
    return NextResponse.json({ error: "Import failed", detail: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }

  return NextResponse.json({
    imported, skipped, errors, total: imported + skipped,
    format: aiUsed ? "ai-mapped" : "rule-mapped",
    batchId: importBatch.id, profileSaved,
    diagnostics: {
      analyzedRows: summary.total,
      newTenants: summary.newTenants,
      updates: summary.updates,
      vacancies: summary.vacancies,
      parseErrors: summary.errors,
      buildingsDetected: summary.buildings,
      aiUsed,
      profileUsed: !!matchedProfileId,
      mode: "direct",
    },
  });
}, "upload");
