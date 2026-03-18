import * as XLSX from "xlsx";
import type { ParseResult, ParseError } from "./types";

/** Detects standard AR aging reports from any PM software by looking for aging bucket columns. */
export function parseGenericAR(buffer: Buffer): ParseResult | null {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return null;

  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rawRows.length < 2) return null;

  // Find header row by looking for aging bucket patterns
  let headerRowIdx = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const row = (rawRows[i] as string[]).map((c) => String(c).toLowerCase().trim());
    const hasAging = row.some((c) => /0.*30|30.*60|60.*90|90.*120|120\+|over 120|current/i.test(c));
    const hasName = row.some((c) => /tenant|name|resident/i.test(c));
    if (hasAging && hasName) {
      headerRowIdx = i;
      headers = row;
      break;
    }
  }

  if (headerRowIdx < 0) return null;

  const errors: ParseError[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown>[] = [];

  function findCol(...patterns: string[]): number {
    for (const p of patterns) {
      const idx = headers.findIndex((h) => h.includes(p));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  const nameCol = findCol("tenant", "name", "resident");
  const unitCol = findCol("unit", "apt", "apartment");
  const buildingCol = findCol("building", "property", "address");
  const col0_30 = findCol("0-30", "current", "0 - 30");
  const col30_60 = findCol("30-60", "31-60", "30 - 60");
  const col60_90 = findCol("60-90", "61-90", "60 - 90");
  const col90_120 = findCol("90-120", "91-120", "90 - 120");
  const col120 = findCol("120+", "over 120", "120 +", "121+");
  const totalCol = findCol("total", "balance");

  if (nameCol < 0) {
    warnings.push("Could not find tenant/name column");
    return null;
  }

  function num(v: unknown): number | undefined {
    if (v == null || v === "") return undefined;
    const n = typeof v === "string" ? parseFloat(v.replace(/[$,()]/g, "")) : Number(v);
    return isNaN(n) ? undefined : n;
  }

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    if (!row || row.every((c) => c == null || c === "")) continue;

    const name = String(row[nameCol] || "").trim();
    if (!name || name.toLowerCase().includes("total") || name.toLowerCase().includes("grand")) continue;

    data.push({
      buildingAddress: buildingCol >= 0 ? String(row[buildingCol] || "").trim() : undefined,
      unitNumber: unitCol >= 0 ? String(row[unitCol] || "").trim() : undefined,
      tenantName: name,
      days0_30: col0_30 >= 0 ? num(row[col0_30]) : undefined,
      days30_60: col30_60 >= 0 ? num(row[col30_60]) : undefined,
      days60_90: col60_90 >= 0 ? num(row[col60_90]) : undefined,
      days90_120: col90_120 >= 0 ? num(row[col90_120]) : undefined,
      days120Plus: col120 >= 0 ? num(row[col120]) : undefined,
      totalBalance: totalCol >= 0 ? num(row[totalCol]) : undefined,
    });
  }

  return {
    success: data.length > 0,
    parserUsed: "generic-ar-aging",
    confidence: 72,
    data,
    errors,
    warnings: warnings.length > 0 ? warnings : ["Low confidence detection — please verify column mapping"],
  };
}
