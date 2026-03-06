import { REQUIRED_FIELDS } from "./headerAliases";
import type { SuggestedMapping, ValidationResult } from "./types";

/**
 * Transform raw rows using the column mapping into key-value records.
 */
export function transformRows(
  rows: (string | number | null)[][],
  mappings: SuggestedMapping[],
  dataStartRow: number,
  ignoredRowIndices: Set<number>,
): Record<string, unknown>[] {
  const activeMappings = mappings.filter((m) => m.mappedField);
  const records: Record<string, unknown>[] = [];

  for (let i = dataStartRow; i < rows.length; i++) {
    if (ignoredRowIndices.has(i)) continue;
    const row = rows[i];
    if (!row || row.every((c) => c === null || c === "")) continue;

    const record: Record<string, unknown> = { _rowIndex: i };
    for (const m of activeMappings) {
      const value = row[m.columnIndex];
      record[m.mappedField!] = value;
    }
    records.push(record);
  }

  return records;
}

/**
 * Validate transformed rows against required fields for the given import type.
 */
export function validateImportRows(
  records: Record<string, unknown>[],
  importType: string,
): ValidationResult {
  // Determine which required fields to check
  const requiredKey = importType === "building_list" ? "building"
    : importType === "yardi_rent_roll" ? "yardi_rent_roll"
    : importType === "arrears_report" ? "arrears_report"
    : "tenant";
  const required = REQUIRED_FIELDS[requiredKey] ?? REQUIRED_FIELDS.tenant;

  const validRows: Record<string, unknown>[] = [];
  const invalidRows: ValidationResult["invalidRows"] = [];

  // Check which required fields are present in any record
  const presentRequired = required.filter((f) =>
    records.some((r) => r[f] !== null && r[f] !== undefined && r[f] !== ""),
  );
  const missingRequired = required.filter((f) => !presentRequired.includes(f));

  for (const record of records) {
    const errors: string[] = [];
    for (const field of required) {
      const val = record[field];
      if (val === null || val === undefined || val === "") {
        errors.push(`Missing required field: ${field}`);
      }
    }

    if (errors.length === 0) {
      validRows.push(record);
    } else {
      invalidRows.push({
        rowIndex: record._rowIndex as number,
        row: record,
        errors,
      });
    }
  }

  return {
    validRows,
    invalidRows,
    missingRequiredFields: missingRequired,
    summary: {
      total: records.length,
      valid: validRows.length,
      invalid: invalidRows.length,
    },
  };
}
