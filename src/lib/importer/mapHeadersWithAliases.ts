import { normalizeHeader } from "./normalizeHeader";
import { TENANT_ALIAS_MAP, BUILDING_ALIAS_MAP } from "./headerAliases";
import type { SuggestedMapping } from "./types";

/**
 * Map headers using deterministic hard alias matching.
 * Returns mappings for all columns; unmapped columns have mappedField = null.
 */
export function mapHeadersWithAliases(
  headers: string[],
  importType: "tenant" | "building" = "tenant",
): SuggestedMapping[] {
  const aliasMap = importType === "building" ? BUILDING_ALIAS_MAP : TENANT_ALIAS_MAP;
  const usedFields = new Set<string>();

  return headers.map((raw, i) => {
    const normalized = normalizeHeader(raw);
    const field = aliasMap.get(normalized) ?? null;

    // Prevent duplicate field assignments
    if (field && usedFields.has(field)) {
      return {
        columnIndex: i,
        sourceHeader: raw,
        normalizedHeader: normalized,
        mappedField: null,
        confidence: 0,
        reason: `Duplicate: "${field}" already mapped to another column`,
        method: "unmapped" as const,
      };
    }

    if (field) usedFields.add(field);

    return {
      columnIndex: i,
      sourceHeader: raw,
      normalizedHeader: normalized,
      mappedField: field,
      confidence: field ? 1.0 : 0,
      reason: field ? `Exact alias match for "${field}"` : "No alias match",
      method: field ? ("alias" as const) : ("unmapped" as const),
    };
  });
}
