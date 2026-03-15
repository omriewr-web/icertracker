import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { analyzeImport } from "@/lib/importer/analyzeImport";
import { fetchBuildingsForMatching, findMatchingBuilding, normalizeAddress, extractAddressFromEntity } from "@/lib/building-matching";
import { commitRentRollImport } from "@/lib/importer/commit";
import { parsedTenantRowSchema } from "@/lib/validations";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

/**
 * Legacy auto-detect import endpoint.
 *
 * This route runs the full analysis pipeline first (same as /api/import/analyze),
 * then uses the detected mappings to parse and commit directly.
 * This ensures consistent behavior with the confirm route:
 *   - Yardi entity/building section detection
 *   - Yardi t-code name fix
 *   - Proper building matching (no "Unknown" fallback)
 *   - Tenant matching (create vs update)
 */

const YARDI_CODE_RE = /^t\d{4,}$/i;
const YARDI_ENTITY_RE = /([^(]+)\(([A-Za-z0-9]{2,20})\)\s*$/;

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

export const POST = withAuth(async (req, { user }) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // File size limit: 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Run analysis pipeline to get mappings
  const analysis = await analyzeImport(buffer, file.name, {
    organizationId: user.organizationId,
  });

  const activeMappings = analysis.suggestedMappings.filter((m) => m.mappedField);
  if (activeMappings.length === 0) {
    return NextResponse.json({ error: "Could not detect any column mappings", warnings: analysis.warnings }, { status: 422 });
  }

  // Parse file using detected mappings (same logic as confirm route)
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const fieldMap: Record<string, number> = {};
  for (const m of activeMappings) {
    if (m.mappedField) fieldMap[m.mappedField] = m.columnIndex;
  }
  const get = (row: unknown[], field: string): unknown =>
    fieldMap[field] !== undefined ? row[fieldMap[field]] : undefined;

  // Detect building sections
  const buildingSections: { rowIndex: number; entityName: string; yardiCode: string }[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i] as unknown[];
    if (!r) continue;
    const firstCell = String(r[0] ?? "").trim();
    if (!firstCell) continue;
    const cleaned = firstCell.replace(/^Total\s+(for\s+)?/i, "");
    const match = cleaned.match(YARDI_ENTITY_RE);
    if (match) buildingSections.push({ rowIndex: i, entityName: firstCell, yardiCode: match[2] });
  }

  // Build row→building map
  const rowToBuilding = new Map<number, { entityName: string; yardiCode: string }>();
  if (buildingSections.length === 1) {
    for (let i = analysis.dataStartRow; i < rawRows.length; i++) rowToBuilding.set(i, buildingSections[0]);
  } else if (buildingSections.length > 1) {
    for (let i = analysis.dataStartRow; i < rawRows.length; i++) {
      const owner = [...buildingSections].reverse().find((s) => s.rowIndex <= i) ?? buildingSections[buildingSections.length - 1];
      rowToBuilding.set(i, owner);
    }
  }

  const existingBuildings = await fetchBuildingsForMatching(user.organizationId);
  const buildingCache = new Map<string, string>();

  // Pre-fetch tenants scoped to org buildings
  const matchedBuildingIds = existingBuildings.map((b) => b.id);
  const allTenants = await prisma.tenant.findMany({
    where: { unit: { buildingId: { in: matchedBuildingIds } } },
    select: { id: true, name: true, unitId: true, yardiResidentId: true, unit: { select: { buildingId: true, unitNumber: true } } },
  });

  const parsedRows: any[] = [];
  const dataStart = analysis.dataStartRow;
  const ignoredSet = new Set(analysis.ignoredRowIndices);

  for (let i = dataStart; i < rawRows.length; i++) {
    if (ignoredSet.has(i)) continue;
    const r = rawRows[i] as unknown[];
    if (!r || r.every((v) => v === "" || v === null || v === undefined)) continue;

    const unit = String(get(r, "unit") ?? "").trim();
    let name = String(get(r, "full_name") ?? "").trim()
      || [String(get(r, "first_name") ?? "").trim(), String(get(r, "last_name") ?? "").trim()].filter(Boolean).join(" ");
    let residentId = String(get(r, "tenant_code") ?? "").trim() || undefined;

    // Yardi name fix
    if (YARDI_CODE_RE.test(name)) {
      if (!residentId) residentId = name;
      name = "";
      const nameColIdx = fieldMap["full_name"];
      if (nameColIdx !== undefined) {
        for (let j = i + 1; j < Math.min(i + 5, rawRows.length); j++) {
          const nextRow = rawRows[j] as unknown[];
          if (!nextRow) continue;
          const nextUnit = String(nextRow[fieldMap["unit"] ?? -1] ?? "").trim();
          if (nextUnit && nextUnit !== unit) break;
          const candidate = String(nextRow[nameColIdx] ?? "").trim();
          if (candidate && !YARDI_CODE_RE.test(candidate) && /[a-zA-Z]{2,}/.test(candidate)) {
            name = candidate;
            break;
          }
        }
      }
    }

    if (!unit && !name) continue;
    if (!unit) {
      parsedRows.push({ rowIndex: i, raw: {}, parsed: {} as any, action: "skip", error: "Missing unit number" });
      continue;
    }

    if (!name && residentId) name = residentId;
    const isVacant = !name || name.toLowerCase().includes("vacant");

    // Resolve building
    const sectionBuilding = rowToBuilding.get(i);
    const propKey = sectionBuilding?.entityName || String(get(r, "building_id") ?? "").trim() || "";

    const yardiMatch = propKey.match(/\(([^)]+)\)\s*$/);
    const yardiCode = yardiMatch ? yardiMatch[1] : null;
    const extractedAddr = extractAddressFromEntity(propKey);
    const cacheKey = yardiCode || normalizeAddress(extractedAddr || propKey || "unmapped");
    let buildingId = buildingCache.get(cacheKey);

    if (!buildingId && propKey) {
      const match = findMatchingBuilding(
        { address: extractedAddr || propKey, block: null, lot: null, entity: propKey, yardiId: yardiCode },
        existingBuildings,
      );
      if (match) buildingId = match.id;
      buildingCache.set(cacheKey, buildingId || "");
    }

    const parsed = {
      property: propKey || "Unknown",
      unit,
      residentId,
      name: isVacant ? "VACANT" : name,
      marketRent: numVal(get(r, "market_rent") || get(r, "monthly_rent")),
      chargeAmount: numVal(get(r, "monthly_rent") || get(r, "market_rent")),
      deposit: numVal(get(r, "security_deposit")),
      balance: numVal(get(r, "current_balance")),
      moveIn: dateVal(get(r, "move_in_date") || get(r, "lease_start_date")),
      leaseExpiration: dateVal(get(r, "lease_end_date")),
      moveOut: dateVal(get(r, "move_out_date")),
      isVacant,
    };

    const validated = parsedTenantRowSchema.safeParse(parsed);
    if (!validated.success) {
      parsedRows.push({ rowIndex: i, raw: parsed, parsed, action: "skip", error: validated.error.issues.map((issue) => issue.message).join(", ") });
      continue;
    }

    if (!buildingId) {
      parsedRows.push({ rowIndex: i, raw: parsed, parsed, action: "skip", error: `No matching building for "${propKey}"` });
      continue;
    }

    // Match tenant
    let matchedTenantId: string | undefined;
    if (residentId) {
      const byYardi = allTenants.find((t) => t.yardiResidentId === residentId);
      if (byYardi) matchedTenantId = byYardi.id;
    }
    if (!matchedTenantId) {
      const normName = (isVacant ? "" : name).toLowerCase().trim();
      const byUnit = allTenants.find((t) =>
        t.unit.buildingId === buildingId && t.unit.unitNumber === unit && t.name.toLowerCase().trim() === normName
      );
      if (byUnit) matchedTenantId = byUnit.id;
    }

    const action = isVacant ? "vacancy" : matchedTenantId ? "update" : "create";
    parsedRows.push({ rowIndex: i, raw: parsed, parsed, action, matchedTenantId, matchedBuildingId: buildingId });
  }

  if (parsedRows.length === 0) {
    return NextResponse.json({ error: "No valid rows found after parsing", warnings: analysis.warnings }, { status: 422 });
  }

  // Row count limit: 5000
  if (parsedRows.length > 5000) {
    return NextResponse.json({ error: "Too many rows (max 5000)" }, { status: 413 });
  }

  // Commit directly
  const importBatch = await prisma.importBatch.create({
    data: { filename: file.name, format: analysis.aiUsed ? "ai-mapped" : "auto-detect", recordCount: 0, status: "processing" },
  });

  let imported = 0;
  let skipped = 0;
  let errors: string[] = [];

  try {
    const result = await commitRentRollImport(parsedRows, { importBatchId: importBatch.id, userId: user.id, organizationId: user.organizationId });
    imported = result.imported;
    skipped = result.skipped;
    errors = result.errors;

    await prisma.importBatch.update({
      where: { id: importBatch.id },
      data: { recordCount: imported, status: errors.length > 0 ? "completed_with_errors" : "completed", errors: errors.length > 0 ? errors : undefined },
    });
  } catch (err) {
    await prisma.importBatch.update({
      where: { id: importBatch.id },
      data: { status: "failed", errors: [err instanceof Error ? err.message : "Unknown error"] },
    });
    return NextResponse.json({ error: "Import failed", detail: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }

  return NextResponse.json({
    imported, skipped, errors,
    total: parsedRows.length,
    format: analysis.aiUsed ? "ai-mapped" : "auto-detect",
    batchId: importBatch.id,
  });
}, "upload");
