import { normalizeHeader } from "./normalizeHeader";
import type { ParsedSheet, StructureAnalysis, ImportFingerprint } from "./types";

/**
 * Detect the likely data type of a column based on sample values.
 */
function detectColumnType(values: (string | number | null)[]): string {
  const nonNull = values.filter((v) => v !== null && v !== "");
  if (nonNull.length === 0) return "empty";

  let numCount = 0;
  let dateCount = 0;
  let currencyCount = 0;
  let unitLikeCount = 0;
  let nameLikeCount = 0;

  for (const v of nonNull) {
    const s = String(v).trim();

    if (/^\$?[\d,]+\.?\d*$/.test(s) || typeof v === "number") {
      numCount++;
      if (s.startsWith("$") || (typeof v === "number" && Math.abs(v as number) > 50)) {
        currencyCount++;
      }
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
      dateCount++;
    }

    if (/^\d{1,4}[A-Za-z]?$/.test(s) || /^(PH|BSMT|APT|STE)\b/i.test(s)) {
      unitLikeCount++;
    }

    if (/^[A-Z][a-z]+ [A-Z][a-z]+/.test(s) || /^[A-Z]{2,}/.test(s)) {
      nameLikeCount++;
    }
  }

  const total = nonNull.length;
  if (currencyCount / total > 0.5) return "currency";
  if (dateCount / total > 0.5) return "date";
  if (unitLikeCount / total > 0.5) return "unit_like";
  if (nameLikeCount / total > 0.4) return "person_name";
  if (numCount / total > 0.7) return "number";
  return "text";
}

/**
 * Build a fingerprint for the parsed sheet and its structure analysis.
 * Used for profile matching.
 */
export function buildFingerprint(
  sheet: ParsedSheet,
  structure: StructureAnalysis,
): ImportFingerprint {
  const { rows, sheetName, columnCount } = sheet;
  const { headerRows, ignoredRowTypes } = structure;

  // Extract normalized headers
  const normalizedHeaders: string[] = [];
  if (headerRows.length > 0) {
    const headerRow = rows[headerRows[0]];
    if (headerRow) {
      for (let c = 0; c < columnCount; c++) {
        normalizedHeaders.push(normalizeHeader(String(headerRow[c] ?? "")));
      }
    }
  }

  // Compute column type hints from sample data rows
  const columnTypeHints: string[] = [];
  const sampleStart = structure.dataStartRow;
  const sampleEnd = Math.min(sampleStart + 20, rows.length);
  const ignoredSet = new Set(structure.ignoredRowIndices);

  for (let c = 0; c < columnCount; c++) {
    const values: (string | number | null)[] = [];
    for (let r = sampleStart; r < sampleEnd; r++) {
      if (ignoredSet.has(r)) continue;
      values.push(rows[r]?.[c] ?? null);
    }
    columnTypeHints.push(detectColumnType(values));
  }

  // Keyword flags
  const hasTotalRows = ignoredRowTypes.some((r) => r.type === "total" || r.type === "subtotal");
  const hasChargeRows = ignoredRowTypes.some((r) => r.type === "charge_row");
  const headerSet = new Set(normalizedHeaders);
  const hasUnitColumn = headerSet.has("unit") || headerSet.has("apt") || headerSet.has("apartment");
  const hasBalanceColumn = headerSet.has("balance") || headerSet.has("current balance");
  const hasTenantLikeColumn = headerSet.has("name") || headerSet.has("tenant") || headerSet.has("resident");

  return {
    normalizedSheetName: sheetName ? normalizeHeader(sheetName) : undefined,
    headerRowCount: headerRows.length,
    normalizedHeaders: normalizedHeaders.filter(Boolean),
    columnCount,
    hasMergedHeaders: structure.hasMergedHeaders,
    keywordFlags: {
      hasTotalRows,
      hasChargeRows,
      hasUnitColumn,
      hasBalanceColumn,
      hasTenantLikeColumn,
    },
    columnTypeHints,
  };
}
