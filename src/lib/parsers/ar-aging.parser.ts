import * as XLSX from "xlsx";

export interface ParsedARRow {
  propertyCode: string;
  unit: string;
  residentId: string;
  tenantName: string;
  balance0_30: number;
  balance31_60: number;
  balance61_90: number;
  balance90plus: number;
  totalBalance: number;
  prepays: number;
  month: Date;
}

function num(v: any): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v.replace(/[$,]/g, "")) : Number(v);
  return isNaN(n) ? 0 : n;
}

function cleanName(raw: string): string {
  if (!raw) return "";
  // Strip " (Current)", " (Past)", etc.
  const parenIdx = raw.indexOf(" (");
  const name = parenIdx >= 0 ? raw.substring(0, parenIdx) : raw;
  return name.trim();
}

function parseMonth(row1Text: string): Date | null {
  // "Age As Of: MM/DD/YYYY Post To: MM/YYYY"
  // Extract the Post To month
  const postToMatch = row1Text.match(/Post\s+To:\s*(\d{1,2})\/(\d{4})/i);
  if (postToMatch) {
    const month = parseInt(postToMatch[1], 10) - 1; // 0-indexed
    const year = parseInt(postToMatch[2], 10);
    return new Date(year, month, 1);
  }
  // Fallback: try Age As Of date
  const ageMatch = row1Text.match(/Age\s+As\s+Of:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (ageMatch) {
    const month = parseInt(ageMatch[1], 10) - 1;
    const year = parseInt(ageMatch[3], 10);
    return new Date(year, month, 1);
  }
  return null;
}

export function parseARAgingExcel(buffer: Buffer): { rows: ParsedARRow[]; errors: string[] } {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const errors: string[] = [];

  if (rawRows.length < 5) {
    errors.push("File has fewer than 5 rows — not a valid Yardi AgingSummary format");
    return { rows: [], errors };
  }

  // Row 0: title "Aged Receivables"
  const titleRow = String(rawRows[0]?.[0] ?? "").trim();
  if (!titleRow.toLowerCase().includes("aged receivables")) {
    errors.push(`Row 1 expected "Aged Receivables" title, got: "${titleRow.substring(0, 60)}"`);
  }

  // Row 1: "Age As Of: ... Post To: MM/YYYY"
  const metaRow = String(rawRows[1]?.[0] ?? "").trim();
  const month = parseMonth(metaRow);
  if (!month) {
    errors.push(`Could not parse month from row 2: "${metaRow.substring(0, 80)}"`);
    return { rows: [], errors };
  }

  // Rows 2-4: headers (skip)
  // Data rows start at row 5 (index 5)
  const rows: ParsedARRow[] = [];
  let currentProperty = "";

  for (let i = 5; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.every((v: any) => v === "" || v == null)) continue;

    const col0 = String(r[0] ?? "").trim();
    const col2 = String(r[2] ?? "").trim();

    // Grand total row — stop
    if (col0.toLowerCase() === "total") break;

    // Track current property code from col 0
    if (col0 && col0 !== currentProperty) {
      currentProperty = col0;
    }

    // Skip subtotal rows (col 2 is empty, NaN, or non-resident)
    if (!col2 || col2.toLowerCase() === "nan") continue;

    // Only import tenant rows: residentId starts with "t"
    if (!col2.toLowerCase().startsWith("t")) continue;

    const rawName = String(r[3] ?? "").trim();
    const tenantName = cleanName(rawName);
    if (!tenantName) continue;

    const unit = String(r[1] ?? "").trim();

    rows.push({
      propertyCode: currentProperty,
      unit,
      residentId: col2,
      tenantName,
      totalBalance: num(r[4]),
      balance0_30: num(r[5]),
      balance31_60: num(r[6]),
      balance61_90: num(r[7]),
      balance90plus: num(r[8]),
      prepays: num(r[9]),
      month,
    });
  }

  if (rows.length === 0) {
    errors.push("No tenant rows found (expected resident IDs starting with 't' in column C)");
  }

  return { rows, errors };
}
