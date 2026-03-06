/**
 * Import contracts define the behavior of each import type.
 * Every import type must declare how matching, updates, and history work.
 */

export interface ImportContract {
  /** Import type identifier */
  importType: string;
  /** Human-readable label */
  label: string;
  /** Fields that form the unique match key (in priority order) */
  uniqueMatchKeys: string[][];
  /** Fields that must be present in the mapping for the import to proceed */
  requiredFields: string[];
  /** How to handle an existing record: "upsert" = update, "skip" = log warning, "append" = always create */
  updateBehavior: "upsert" | "skip" | "append";
  /** Whether this import type requires admin review before commit */
  requiresReview: boolean;
  /** Whether to create a BalanceSnapshot on import */
  historyBehavior: "snapshot" | "none";
  /** Prisma entity type string for ImportRow tracking */
  entityType: string;
}

export const IMPORT_CONTRACTS: Record<string, ImportContract> = {
  rent_roll: {
    importType: "rent_roll",
    label: "Rent Roll / Tenant List",
    uniqueMatchKeys: [
      ["yardiResidentId"],                      // tier 1: exact resident ID
      ["buildingId", "unitNumber", "name"],      // tier 2: composite
    ],
    requiredFields: ["unit", "full_name"],
    updateBehavior: "upsert",
    requiresReview: true,
    historyBehavior: "snapshot",
    entityType: "tenant",
  },

  legal_cases: {
    importType: "legal_cases",
    label: "Legal Cases",
    uniqueMatchKeys: [
      ["tenantId"],                             // matched via confidence scoring
      ["buildingAddress", "unitNumber", "tenantName"],
    ],
    requiredFields: ["tenantName"],
    updateBehavior: "upsert",
    requiresReview: true,
    historyBehavior: "none",
    entityType: "legal_case",
  },

  violations: {
    importType: "violations",
    label: "Violations",
    uniqueMatchKeys: [
      ["source", "externalId"],                 // unique constraint in schema
    ],
    requiredFields: ["externalId", "source", "description"],
    updateBehavior: "upsert",
    requiresReview: false,
    historyBehavior: "none",
    entityType: "violation",
  },

  vacancy_pipeline: {
    importType: "vacancy_pipeline",
    label: "Vacancy Pipeline",
    uniqueMatchKeys: [
      ["buildingId", "unitId"],                 // one active vacancy per unit
    ],
    requiredFields: ["building_id", "unit"],
    updateBehavior: "upsert",
    requiresReview: false,
    historyBehavior: "none",
    entityType: "vacancy",
  },
};

/** Resolve an import type string to its contract, falling back to rent_roll */
export function getImportContract(importType: string): ImportContract {
  // Normalize common aliases
  const normalized = importType.toLowerCase().replace(/[-\s]/g, "_");
  if (normalized.includes("legal")) return IMPORT_CONTRACTS.legal_cases;
  if (normalized.includes("violation")) return IMPORT_CONTRACTS.violations;
  if (normalized.includes("vacancy")) return IMPORT_CONTRACTS.vacancy_pipeline;
  return IMPORT_CONTRACTS[normalized] ?? IMPORT_CONTRACTS.rent_roll;
}
