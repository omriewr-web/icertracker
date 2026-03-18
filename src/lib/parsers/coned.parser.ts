import * as XLSX from "xlsx";
import type { ParseResult, ParseError } from "./types";

const CONED_COLS = ["account", "service address", "meter", "usage", "amount", "bill date"];

function normalizeHeader(h: string): string {
  return String(h).toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
}

export function parseConEd(buffer: Buffer): ParseResult | null {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return null;

  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rawRows.length < 2) return null;

  let headerRowIdx = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const row = (rawRows[i] as string[]).map(normalizeHeader);
    const matched = CONED_COLS.filter((c) => row.some((h) => h.includes(c))).length;
    if (matched >= 3) {
      headerRowIdx = i;
      headers = row;
      break;
    }
  }

  if (headerRowIdx < 0) return null;

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

  const errors: ParseError[] = [];
  const data: Record<string, unknown>[] = [];

  const acctCol = find("account");
  const addrCol = find("service address", "address");
  const meterCol = find("meter");
  const usageCol = find("usage", "kwh", "consumption");
  const amountCol = find("amount", "charge", "total");
  const dateCol = find("bill date", "date");

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    if (!row || row.every((c) => c == null || c === "")) continue;

    const acct = acctCol >= 0 ? String(row[acctCol] || "").trim() : "";
    if (!acct) continue;

    const amtRaw = amountCol >= 0 ? row[amountCol] : undefined;
    const amt = amtRaw != null && amtRaw !== ""
      ? parseFloat(String(amtRaw).replace(/[$,]/g, ""))
      : undefined;

    const usageRaw = usageCol >= 0 ? row[usageCol] : undefined;
    const usage = usageRaw != null && usageRaw !== ""
      ? parseFloat(String(usageRaw).replace(/,/g, ""))
      : undefined;

    data.push({
      accountNumber: acct,
      serviceAddress: addrCol >= 0 ? String(row[addrCol] || "").trim() : undefined,
      meterNumber: meterCol >= 0 ? String(row[meterCol] || "").trim() : undefined,
      usage: isNaN(usage ?? NaN) ? undefined : usage,
      amount: isNaN(amt ?? NaN) ? undefined : amt,
      billDate: dateCol >= 0 ? String(row[dateCol] || "").trim() : undefined,
      provider: "ConEd",
    });
  }

  const confidence = CONED_COLS.filter((c) => headers.some((h) => h.includes(c))).length / CONED_COLS.length;

  return {
    success: data.length > 0,
    parserUsed: "coned-bill",
    confidence: Math.round(confidence * 100),
    data,
    errors,
    warnings: [],
  };
}
