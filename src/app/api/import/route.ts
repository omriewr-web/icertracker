import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { parseRentRollExcel, type ParsedTenant } from "@/lib/excel-import";
import { parsedTenantRowSchema } from "@/lib/validations";
import { findMatchingBuilding, fetchBuildingsForMatching, generateYardiId, normalizeAddress, extractAddressFromEntity } from "@/lib/building-matching";
import { commitRentRollImport } from "@/lib/importer/commit";
import * as XLSX from "xlsx";

// ── Mapped import: convert AI column mapping → ParsedTenant[] ──

interface ColumnMappingEntry {
  columnIndex: number;
  sourceHeader: string;
  mappedField: string | null;
  confidence: number;
}

function numVal(v: any): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v.replace(/[$,]/g, "")) : Number(v);
  return isNaN(n) ? 0 : n;
}

function dateVal(v: any): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString().split("T")[0];
  if (typeof v === "number" && v > 30000 && v < 60000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const parsed = new Date(v);
  return isNaN(parsed.getTime()) ? undefined : parsed.toISOString().split("T")[0];
}

function parseMappedRows(
  buffer: Buffer,
  mapping: ColumnMappingEntry[],
  dataStartRow: number,
): { tenants: ParsedTenant[]; propertyName: string; errors: string[]; format: string } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const fieldMap: Record<string, number> = {};
  for (const m of mapping) {
    if (m.mappedField) fieldMap[m.mappedField] = m.columnIndex;
  }

  const get = (row: any[], field: string): any =>
    fieldMap[field] !== undefined ? row[fieldMap[field]] : undefined;

  const tenants: ParsedTenant[] = [];
  const errors: string[] = [];

  for (let i = dataStartRow - 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.every((v: any) => v === "" || v === null || v === undefined)) continue;

    const unit = String(get(r, "unit") ?? "").trim();
    const name = String(get(r, "full_name") ?? get(r, "last_name") ?? "").trim();
    if (!unit && !name) continue;
    if (!unit) {
      errors.push(`Row ${i + 1}: missing unit number`);
      continue;
    }

    const fullName = String(get(r, "full_name") ?? "").trim()
      || [String(get(r, "first_name") ?? "").trim(), String(get(r, "last_name") ?? "").trim()].filter(Boolean).join(" ");

    const isVacant = !fullName || fullName.toLowerCase().includes("vacant");

    tenants.push({
      property: String(get(r, "building_id") ?? "").trim(),
      unit,
      unitType: undefined,
      residentId: String(get(r, "tenant_code") ?? "").trim() || undefined,
      name: isVacant ? "VACANT" : fullName,
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
    });
  }

  return { tenants, propertyName: "", errors, format: "ai-mapped" };
}

/**
 * Convert ParsedTenant[] to the ParsedRow format expected by commitRentRollImport.
 */
function toCommitRows(tenants: ParsedTenant[], parseErrors: string[]) {
  const rows = tenants.map((t, i) => {
    const validated = parsedTenantRowSchema.safeParse(t);
    if (!validated.success) {
      return {
        rowIndex: i,
        raw: t as any,
        parsed: t as any,
        action: "skip" as const,
        error: validated.error.issues.map((issue) => issue.message).join(", "),
      };
    }
    return {
      rowIndex: i,
      raw: t as any,
      parsed: {
        property: t.property || "Unknown",
        unit: t.unit,
        unitType: t.unitType,
        residentId: t.residentId,
        name: t.name,
        marketRent: t.marketRent,
        chargeCode: t.chargeCode,
        chargeAmount: t.chargeAmount || t.marketRent,
        deposit: t.deposit,
        balance: t.balance,
        moveIn: t.moveIn,
        leaseExpiration: t.leaseExpiration,
        moveOut: t.moveOut,
        isVacant: t.isVacant,
      },
      action: (t.isVacant ? "vacancy" : "create") as "create" | "vacancy" | "skip",
    };
  });

  // Prepend parse errors as skip rows
  for (const err of parseErrors) {
    rows.push({
      rowIndex: rows.length,
      raw: {} as any,
      parsed: {} as any,
      action: "skip",
      error: err,
    });
  }

  return rows;
}

export const POST = withAuth(async (req, { user }) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  const columnMappingRaw = formData.get("columnMapping") as string | null;
  const dataStartRowRaw = formData.get("dataStartRow") as string | null;

  let result: { tenants: ParsedTenant[]; propertyName: string; errors: string[]; format: string };

  if (columnMappingRaw && dataStartRowRaw) {
    const mapping: ColumnMappingEntry[] = JSON.parse(columnMappingRaw);
    const dataStartRow = parseInt(dataStartRowRaw, 10);
    result = parseMappedRows(buffer, mapping, dataStartRow);
  } else {
    result = parseRentRollExcel(buffer);
  }

  const { tenants, errors: parseErrors } = result;

  if (tenants.length === 0) {
    return NextResponse.json({ error: "No tenant records found", errors: parseErrors }, { status: 400 });
  }

  const importBatch = await prisma.importBatch.create({
    data: { filename: file.name, format: result.format, recordCount: 0, status: "processing" },
  });

  // Convert to commit format and use shared handler
  const commitRows = toCommitRows(tenants, parseErrors);
  const { imported, skipped, errors } = await commitRentRollImport(commitRows, {
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

  return NextResponse.json({
    imported, skipped, errors,
    total: tenants.length,
    format: result.format,
    batchId: importBatch.id,
  });
}, "upload");
