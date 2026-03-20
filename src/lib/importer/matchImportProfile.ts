import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { ImportFingerprint, ProfileMatch, SuggestedMapping, MappingMethod } from "./types";
import { CONFIDENCE_THRESHOLDS } from "./types";

/**
 * Compute similarity between two fingerprints (0-1).
 */
function fingerprintSimilarity(a: ImportFingerprint, b: ImportFingerprint, cachedSetA?: Set<string>): number {
  let score = 0;
  let weights = 0;

  // Header count match (weight: 1)
  if (a.headerRowCount === b.headerRowCount) score += 1;
  weights += 1;

  // Column count similarity (weight: 2)
  const colDiff = Math.abs(a.columnCount - b.columnCount);
  score += (1 - Math.min(colDiff / Math.max(a.columnCount, b.columnCount, 1), 1)) * 2;
  weights += 2;

  // Merged headers match (weight: 0.5)
  if (a.hasMergedHeaders === b.hasMergedHeaders) score += 0.5;
  weights += 0.5;

  // Normalized header overlap (weight: 5 — most important)
  const setA = cachedSetA ?? new Set(a.normalizedHeaders);
  const setB = new Set(b.normalizedHeaders);
  const intersection = [...setA].filter((h) => setB.has(h)).length;
  const union = new Set([...setA, ...setB]).size;
  if (union > 0) {
    score += (intersection / union) * 5;
  }
  weights += 5;

  // Sheet name match (weight: 1)
  if (a.normalizedSheetName && b.normalizedSheetName) {
    if (a.normalizedSheetName === b.normalizedSheetName) score += 1;
  }
  weights += 1;

  // Keyword flags (weight: 1.5)
  const flagKeys = Object.keys(a.keywordFlags) as (keyof ImportFingerprint["keywordFlags"])[];
  let flagMatch = 0;
  for (const key of flagKeys) {
    if (a.keywordFlags[key] === b.keywordFlags[key]) flagMatch++;
  }
  score += (flagMatch / flagKeys.length) * 1.5;
  weights += 1.5;

  return score / weights;
}

/**
 * Search saved import profiles for a fingerprint match.
 * Returns the best match above the suggest threshold, or null.
 */
export async function matchImportProfile(
  fingerprint: ImportFingerprint,
  importType: string,
  organizationId: string = "default",
): Promise<ProfileMatch | null> {
  const profiles = await prisma.importProfile.findMany({
    where: { organizationId, isActive: true, importType },
  });

  if (profiles.length === 0) return null;

  let bestProfile: typeof profiles[0] | null = null;
  let bestScore = 0;

  // Cache the input fingerprint's header Set to avoid recreating it each iteration
  const inputHeaderSet = new Set(fingerprint.normalizedHeaders);

  for (const profile of profiles) {
    const savedFingerprint = profile.fingerprintJson as unknown as ImportFingerprint;
    const score = fingerprintSimilarity(fingerprint, savedFingerprint, inputHeaderSet);
    if (score > bestScore) {
      bestScore = score;
      bestProfile = profile;
    }
  }

  if (!bestProfile || bestScore < CONFIDENCE_THRESHOLDS.PROFILE_SUGGEST) {
    return null;
  }

  const savedMapping = bestProfile.mappingJson as unknown as SuggestedMapping[];
  // Re-tag method as "profile"
  const mapping = savedMapping.map((m) => ({
    ...m,
    method: "profile" as MappingMethod,
    confidence: Math.min(m.confidence, bestScore),
    reason: `From saved profile "${bestProfile!.name}" (${(bestScore * 100).toFixed(0)}% match)`,
  }));

  return {
    id: bestProfile.id,
    name: bestProfile.name,
    confidence: bestScore,
    mapping,
  };
}

/**
 * Save or update an import profile after confirmed import.
 */
export async function saveImportProfile(opts: {
  organizationId?: string | null;
  name: string;
  importType: string;
  sheetNamePattern?: string;
  headerRowCount: number;
  fingerprint: ImportFingerprint;
  mapping: SuggestedMapping[];
  ignoredRules?: unknown;
  createdById?: string;
}): Promise<string> {
  const profile = await prisma.importProfile.create({
    data: {
      organizationId: opts.organizationId ?? "default",
      name: opts.name,
      importType: opts.importType,
      sheetNamePattern: opts.sheetNamePattern,
      headerRowCount: opts.headerRowCount,
      fingerprintJson: opts.fingerprint as unknown as Prisma.InputJsonValue,
      mappingJson: opts.mapping as unknown as Prisma.InputJsonValue,
      ignoredRulesJson: (opts.ignoredRules ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      createdById: opts.createdById,
    },
  });
  return profile.id;
}
