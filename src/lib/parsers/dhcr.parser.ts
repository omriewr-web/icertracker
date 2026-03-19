import * as XLSX from "xlsx";
import type { ParseResult, ParseError } from "./types";

const DHCR_COLS = ["building id", "apartment", "legal rent", "registration date", "owner"];

function normalizeHeader(h: string): string {
  return String(h).toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
}

export function parseDHCR(buffer: Buffer): ParseResult | null {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return null;

  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rawRows.length < 2) return null;

  // Try first few rows for headers
  let headerRowIdx = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const row = (rawRows[i] as string[]).map(normalizeHeader);
    const matched = DHCR_COLS.filter((c) => row.some((h) => h.includes(c))).length;
    if (matched >= 3) {
      headerRowIdx = i;
      headers = row;
      break;
    }
  }

  if (headerRowIdx < 0) return null;

  const errors: ParseError[] = [];
  const data: Record<string, unknown>[] = [];

  const colMap = new Map<string, number>();
  headers.forEach((h, i) => colMap.set(h, i));

  function find(...patterns: string[]): number {
    for (const p of patterns) {
      for (const [h, i] of colMap) {
        if (h.includes(p)) return i;
      }
    }
    return -1;
  }

  const buildingCol = find("building", "address", "property");
  const unitCol = find("apartment", "unit", "apt");
  const rentCol = find("legal rent", "rent");
  const dateCol = find("registration", "effective");
  const ownerCol = find("owner");
  const tenantCol = find("tenant", "name");

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    if (!row || row.every((c) => c == null || c === "")) continue;

    const unit = unitCol >= 0 ? String(row[unitCol] || "").trim() : "";
    if (!unit) continue;

    const rentVal = rentCol >= 0 ? row[rentCol] : undefined;
    const rent = rentVal != null && rentVal !== ""
      ? parseFloat(String(rentVal).replace(/[$,]/g, ""))
      : undefined;

    data.push({
      buildingAddress: buildingCol >= 0 ? String(row[buildingCol] || "").trim() : "",
      unitNumber: unit,
      legalRent: isNaN(rent ?? NaN) ? undefined : rent,
      registrationDate: dateCol >= 0 ? String(row[dateCol] || "").trim() : undefined,
      ownerName: ownerCol >= 0 ? String(row[ownerCol] || "").trim() : undefined,
      tenantName: tenantCol >= 0 ? String(row[tenantCol] || "").trim() : undefined,
    });
  }

  const confidence = DHCR_COLS.filter((c) => headers.some((h) => h.includes(c))).length / DHCR_COLS.length;

  return {
    success: data.length > 0,
    parserUsed: "dhcr-registration",
    confidence: Math.round(confidence * 100),
    data,
    errors,
    warnings: [],
  };
}
