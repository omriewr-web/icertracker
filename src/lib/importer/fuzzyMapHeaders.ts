import { normalizeHeader } from "./normalizeHeader";
import { TENANT_ALIASES, BUILDING_ALIASES } from "./headerAliases";
import { CONFIDENCE_THRESHOLDS } from "./types";
import type { SuggestedMapping } from "./types";

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Similarity score (0-1) based on normalized Levenshtein distance.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Fuzzy-match unmapped headers against all known aliases.
 * Only returns matches above FUZZY_REJECT threshold.
 */
export function fuzzyMapHeaders(
  partialMappings: SuggestedMapping[],
  importType: "tenant" | "building" = "tenant",
): SuggestedMapping[] {
  const aliases = importType === "building" ? BUILDING_ALIASES : TENANT_ALIASES;
  const usedFields = new Set(
    partialMappings.filter((m) => m.mappedField).map((m) => m.mappedField!),
  );

  // Build flat list of (alias, field) pairs
  const aliasPairs: { alias: string; field: string }[] = [];
  for (const [field, aliasList] of Object.entries(aliases)) {
    for (const alias of aliasList) {
      aliasPairs.push({ alias, field });
    }
  }

  return partialMappings.map((mapping) => {
    // Skip already mapped columns
    if (mapping.mappedField) return mapping;
    if (!mapping.normalizedHeader) return mapping;

    let bestField: string | null = null;
    let bestScore = 0;
    let bestAlias = "";

    for (const { alias, field } of aliasPairs) {
      if (usedFields.has(field)) continue;
      const score = similarity(mapping.normalizedHeader, alias);
      if (score > bestScore) {
        bestScore = score;
        bestField = field;
        bestAlias = alias;
      }
    }

    if (bestField && bestScore >= CONFIDENCE_THRESHOLDS.FUZZY_REJECT) {
      usedFields.add(bestField);
      return {
        ...mapping,
        mappedField: bestField,
        confidence: bestScore,
        reason: `Fuzzy match: "${mapping.normalizedHeader}" ≈ "${bestAlias}" → ${bestField} (${(bestScore * 100).toFixed(0)}%)`,
        method: "fuzzy" as const,
      };
    }

    return mapping;
  });
}
