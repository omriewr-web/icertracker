import * as XLSX from "xlsx";
import type { ParseResult, ParseError } from "./types";

const APPFOLIO_RENT_ROLL_COLS = ["property", "unit", "tenant", "rent", "lease from", "lease to", "status"];
const APPFOLIO_AR_COLS = ["property", "unit", "tenant", "current", "30 days", "60 days", "90+ days", "total"];

function normalizeHeader(h: string): string {
  return String(h).toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
}

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "string" ? parseFloat(v.replace(/[$,()]/g, "")) : Number(v);
  return isNaN(n) ? undefined : n;
}

function dateStr(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return String(v).trim();
}

export function parseAppFolio(buffer: Buffer): ParseResult | null {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return null;

  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rawRows.length < 2) return null;

  const headers = (rawRows[0] as string[]).map(normalizeHeader);

  // Detect: rent roll or AR aging
  const rentRollScore = APPFOLIO_RENT_ROLL_COLS.filter((c) => headers.some((h) => h.includes(c))).length / APPFOLIO_RENT_ROLL_COLS.length;
  const arScore = APPFOLIO_AR_COLS.filter((c) => headers.some((h) => h.includes(c))).length / APPFOLIO_AR_COLS.length;

  if (rentRollScore < 0.5 && arScore < 0.5) return null;

  const isAR = arScore > rentRollScore;
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

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    if (!row || row.every((c) => c == null || c === "")) continue;

    if (isAR) {
      const name = String(row[find("tenant", "name")] || "").trim();
      if (!name || name.toLowerCase().includes("total")) continue;
      data.push({
        buildingAddress: String(row[find("property", "building")] || "").trim(),
        unitNumber: String(row[find("unit")] || "").trim(),
        tenantName: name,
        days0_30: num(row[find("current")]),
        days30_60: num(row[find("30 day", "30day")]),
        days60_90: num(row[find("60 day", "60day")]),
        days90_120: num(row[find("90 day", "90day", "90+")]),
        totalBalance: num(row[find("total", "balance")]),
      });
    } else {
      const tenant = String(row[find("tenant", "name")] || "").trim();
      if (!tenant) continue;
      data.push({
        buildingAddress: String(row[find("property", "building")] || "").trim(),
        unitNumber: String(row[find("unit")] || "").trim(),
        tenantName: tenant,
        monthlyRent: num(row[find("rent", "market rent")]),
        leaseStart: dateStr(row[find("lease from", "start")]),
        leaseEnd: dateStr(row[find("lease to", "end", "expir")]),
        status: String(row[find("status")] || "").trim() || undefined,
      });
    }
  }

  return {
    success: data.length > 0,
    parserUsed: isAR ? "appfolio-ar-aging" : "appfolio-rent-roll",
    confidence: Math.round((isAR ? arScore : rentRollScore) * 100),
    data,
    errors,
    warnings: [],
  };
}
