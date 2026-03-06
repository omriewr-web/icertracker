import { normalizeHeader } from "./normalizeHeader";
import { TENANT_ALIAS_MAP, BUILDING_ALIAS_MAP } from "./headerAliases";
import type { ParsedSheet, StructureAnalysis, ImportFileType, IgnoredRowInfo } from "./types";

const TOTAL_LABELS = new Set([
  "total", "totals", "grand total", "subtotal", "sub total",
  "totals:", "balance total", "sum",
]);

const SECTION_LABELS = new Set([
  "current/notice/vacant residents",
  "future residents/applicants",
  "past residents",
  "summary groups",
  "summary of charges by charge code",
]);

const HEADER_CONTINUATION_WORDS = new Set([
  "rent", "deposit", "code", "expiration", "sq ft", "sqft", "date",
]);

/**
 * Analyze the structure of a parsed sheet to detect headers, data start, ignored rows, etc.
 */
export function analyzeStructure(sheet: ParsedSheet): StructureAnalysis {
  const { rows, mergedCells, columnCount } = sheet;
  const allAliases = new Map([...TENANT_ALIAS_MAP, ...BUILDING_ALIAS_MAP]);
  const warnings: string[] = [];
  const ignoredRowTypes: IgnoredRowInfo[] = [];

  // ── Find header rows ──
  let headerRows: number[] = [];
  let dataStartRow = 0;
  let hasMergedHeaders = mergedCells.some((m) => m.startRow <= 2 && m.startCol !== m.endCol);

  // Scan first 10 rows for header candidates
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;

    const nonEmpty = row.filter((c) => c !== null && c !== "");
    if (nonEmpty.length < 2) continue;

    // Count how many cells match known aliases
    let aliasHits = 0;
    for (const cell of nonEmpty) {
      const norm = normalizeHeader(String(cell));
      if (allAliases.has(norm)) aliasHits++;
    }

    // If ≥2 alias hits, this looks like a header row
    if (aliasHits >= 2) {
      headerRows.push(i);

      // Check if next row is a continuation header
      if (i + 1 < rows.length) {
        const nextRow = rows[i + 1];
        if (nextRow) {
          const nextNonEmpty = nextRow.filter((c) => c !== null && c !== "");
          const isContinuation = nextNonEmpty.some((c) => {
            const s = String(c).toLowerCase().trim();
            return HEADER_CONTINUATION_WORDS.has(s);
          });
          if (isContinuation) {
            headerRows.push(i + 1);
            hasMergedHeaders = true;
          }
        }
      }
      break;
    }
  }

  // If no header found, default to row 0
  if (headerRows.length === 0) {
    const firstRow = rows[0];
    if (firstRow && firstRow.some((c) => c !== null && typeof c === "string")) {
      headerRows = [0];
    }
  }

  dataStartRow = headerRows.length > 0 ? headerRows[headerRows.length - 1] + 1 : 0;

  // ── Detect ignored rows ──
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row) {
      ignoredRowTypes.push({ rowIndex: i, type: "blank" });
      continue;
    }

    const nonNull = row.filter((c) => c !== null && c !== "");
    if (nonNull.length === 0) {
      ignoredRowTypes.push({ rowIndex: i, type: "blank" });
      continue;
    }

    // Check for section headers
    const firstCell = String(row[0] ?? "").trim().toLowerCase();
    if (SECTION_LABELS.has(firstCell)) {
      ignoredRowTypes.push({ rowIndex: i, type: "section_header", label: firstCell });
      continue;
    }

    // Check for total/subtotal rows
    for (const cell of row) {
      if (cell === null) continue;
      const s = String(cell).toLowerCase().trim();
      if (TOTAL_LABELS.has(s)) {
        ignoredRowTypes.push({ rowIndex: i, type: "total", label: s });
        break;
      }
    }

    // Detect charge-only rows: col 0 is empty, only 1-2 cells have values
    if ((row[0] === null || row[0] === "") && nonNull.length <= 2 && nonNull.length > 0) {
      // Check if the values look like amounts (numbers)
      const hasAmount = nonNull.some((c) => typeof c === "number" || /^\$?[\d,.]+$/.test(String(c)));
      if (hasAmount) {
        ignoredRowTypes.push({ rowIndex: i, type: "charge_row" });
      }
    }

    // Detect repeated header rows
    if (i > dataStartRow && headerRows.length > 0) {
      const headerRow = rows[headerRows[0]];
      if (headerRow && row.length >= headerRow.length) {
        const matchCount = row.filter((c, j) => c !== null && headerRow[j] !== null && String(c) === String(headerRow[j])).length;
        if (matchCount >= 3 && matchCount >= headerRow.filter((c) => c !== null).length * 0.7) {
          ignoredRowTypes.push({ rowIndex: i, type: "repeated_header" });
        }
      }
    }
  }

  const ignoredRowIndices = ignoredRowTypes.map((r) => r.rowIndex);

  // Skip section headers right after header rows
  while (dataStartRow < rows.length) {
    if (ignoredRowIndices.includes(dataStartRow)) {
      dataStartRow++;
    } else {
      break;
    }
  }

  // ── Detect file type ──
  const fileTypeGuess = detectFileType(sheet, headerRows, allAliases);
  const fileTypeConfidence = fileTypeGuess === "unknown" ? 0.1 : 0.7;

  return {
    fileTypeGuess,
    fileTypeConfidence,
    headerRows,
    dataStartRow,
    ignoredRowIndices,
    ignoredRowTypes,
    hasMergedHeaders,
    warnings,
  };
}

function detectFileType(
  sheet: ParsedSheet,
  headerRows: number[],
  allAliases: Map<string, string>,
): ImportFileType {
  const { rows, sheetName } = sheet;
  const sheetLower = sheetName.toLowerCase();

  // Sheet name hints
  if (sheetLower.includes("ar aging") || sheetLower.includes("aging")) return "arrears_report";
  if (sheetLower.includes("rent roll")) return "yardi_rent_roll";
  if (sheetLower.includes("violation")) return "violations_report";

  // First cell hints
  const a1 = String(rows[0]?.[0] ?? "").toLowerCase();
  if (a1.includes("rent roll with lease charges")) return "yardi_rent_roll";
  if (a1.includes("aged receivables")) return "arrears_report";

  // Header-based detection
  if (headerRows.length === 0) return "unknown";

  const headerCells = rows[headerRows[0]]
    ?.map((c) => normalizeHeader(String(c ?? "")))
    .filter(Boolean) ?? [];

  const fields = new Set(headerCells.map((h) => allAliases.get(h)).filter(Boolean));

  // Count field types
  const hasTenantFields = ["full_name", "tenant_code", "monthly_rent", "current_balance"]
    .some((f) => fields.has(f));
  const hasBuildingFields = ["address", "borough", "block", "lot", "floors"]
    .some((f) => fields.has(f));
  const hasBalanceFields = ["current_balance", "arrears_status"]
    .some((f) => fields.has(f));

  if (hasBuildingFields && !hasTenantFields) return "building_list";
  if (hasBalanceFields) return "arrears_report";
  if (hasTenantFields) return "tenant_list";
  if (fields.has("unit")) return "generic_property_data";

  return "unknown";
}
