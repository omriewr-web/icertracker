import { prisma } from "@/lib/prisma";

const ABBREVIATIONS: Record<string, string> = {
  st: "street",
  ave: "avenue",
  blvd: "boulevard",
  dr: "drive",
  rd: "road",
  pl: "place",
  ct: "court",
  ln: "lane",
};

const ENTITY_NOISE = /\b(llc|inc|corp|lp|associates|group|holdings|management)\b/g;

export function normalizeAddress(addr: string): string {
  let result = addr.toLowerCase().trim();
  // Expand abbreviations (word-boundary match)
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    result = result.replace(new RegExp(`\\b${abbr}\\.?\\b`, "g"), full);
  }
  // Collapse whitespace, strip non-alphanumeric (except spaces)
  result = result.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return result;
}

export function normalizeBlockLot(val: string): string {
  return val.replace(/^0+/, "").trim();
}

export function normalizeEntity(entity: string): string {
  return entity
    .toLowerCase()
    .replace(ENTITY_NOISE, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface BuildingCandidate {
  address: string;
  block?: string | null;
  lot?: string | null;
  entity?: string | null;
}

interface ExistingBuilding {
  id: string;
  address: string;
  block: string | null;
  lot: string | null;
  entity: string | null;
  yardiId: string;
}

export function findMatchingBuilding(
  candidate: BuildingCandidate,
  existingBuildings: ExistingBuilding[]
): { id: string; matchedBy: string } | null {
  // 1. Block+lot match (both non-empty, normalized)
  if (candidate.block && candidate.lot) {
    const normBlock = normalizeBlockLot(candidate.block);
    const normLot = normalizeBlockLot(candidate.lot);
    const match = existingBuildings.find(
      (b) =>
        b.block &&
        b.lot &&
        normalizeBlockLot(b.block) === normBlock &&
        normalizeBlockLot(b.lot) === normLot
    );
    if (match) return { id: match.id, matchedBy: "block+lot" };
  }

  // 2. Normalized address equality
  const normAddr = normalizeAddress(candidate.address);
  const addrMatch = existingBuildings.find(
    (b) => normalizeAddress(b.address) === normAddr
  );
  if (addrMatch) return { id: addrMatch.id, matchedBy: "address" };

  // 3. Normalized entity contains-match (both non-empty)
  if (candidate.entity) {
    const normEntity = normalizeEntity(candidate.entity);
    if (normEntity) {
      const entityMatch = existingBuildings.find(
        (b) =>
          b.entity &&
          (() => {
            const normExisting = normalizeEntity(b.entity!);
            return (
              normExisting.includes(normEntity) ||
              normEntity.includes(normExisting)
            );
          })()
      );
      if (entityMatch) return { id: entityMatch.id, matchedBy: "entity" };
    }
  }

  return null;
}

export async function fetchBuildingsForMatching() {
  return prisma.building.findMany({
    select: {
      id: true,
      address: true,
      block: true,
      lot: true,
      entity: true,
      yardiId: true,
    },
  });
}

/**
 * Extract a street address from an entity-style building name.
 * e.g. "Icer of 111 West 136th Street LLC(111w136)" → "111 West 136th Street"
 *      "1776 Castle Hill Apt Owners, LLC(1776cast)" → "1776 Castle Hill"
 */
export function extractAddressFromEntity(name: string): string | null {
  // Remove yardiId parenthesized suffix
  let clean = name.replace(/\([^)]+\)$/, "").trim();
  // Remove LLC/Inc/etc and common suffixes
  clean = clean
    .replace(/\s*[-–]\s*(Rental|Coop|Co-op|Commercial)\s*$/i, "")
    .replace(/,?\s*(L\.?L\.?C\.?|LLC|Inc\.?|Corp\.?|LP|Associates?|Group|Holdings?|Holding|Management|Owners?|Properties|Property|Realty|Ltd\.?|Co\.?,?\s*Ltd\.?)\s*$/gi, "")
    .replace(/,?\s*(L\.?L\.?C\.?|LLC|Inc\.?|Corp\.?|LP|Associates?|Group|Holdings?|Holding|Management|Owners?|Properties|Property|Realty|Ltd\.?|Co\.?,?\s*Ltd\.?)\s*$/gi, "")
    .trim()
    .replace(/,\s*$/, "")
    .replace(/\s*&\s*$/, "")
    .trim();
  // Remove common prefixes like "Icer of", "Rebar"
  clean = clean
    .replace(/^(?:Icer\s+of|Rebar|ICER\s+of)\s+/i, "")
    .trim();
  // Must start with a number to be a street address
  if (/^\d/.test(clean)) return clean;
  return null;
}

/**
 * Get the best display address for a building, preferring altAddress over extracted address over raw address.
 */
export function getDisplayAddress(building: { address: string; altAddress?: string | null }): string {
  if (building.altAddress?.trim()) return building.altAddress.trim();
  return extractAddressFromEntity(building.address) || building.address;
}

/**
 * Match a building row (with block/lot/buildingId) against existing buildings.
 * Priority: 1) block+lot  2) normalized address  3) yardiId/building_id
 */
export function matchBuildingByRow(
  row: { address: string; block?: string | null; lot?: string | null; buildingId?: string | null },
  existing: Array<{ id: string; address: string; block: string | null; lot: string | null; yardiId: string }>
): { id: string; matchedBy: string } | null {
  // 1. Block + Lot match (primary)
  if (row.block && row.lot) {
    const normBlock = normalizeBlockLot(row.block);
    const normLot = normalizeBlockLot(row.lot);
    const match = existing.find(
      (b) =>
        b.block && b.lot &&
        normalizeBlockLot(b.block) === normBlock &&
        normalizeBlockLot(b.lot) === normLot
    );
    if (match) return { id: match.id, matchedBy: "block+lot" };
  }

  // 2. Normalized address match (fallback)
  const normAddr = normalizeAddress(row.address);
  const addrMatch = existing.find((b) => normalizeAddress(b.address) === normAddr);
  if (addrMatch) return { id: addrMatch.id, matchedBy: "address" };

  // 3. building_id → yardiId match
  if (row.buildingId) {
    const idMatch = existing.find((b) => b.yardiId === row.buildingId);
    if (idMatch) return { id: idMatch.id, matchedBy: "building_id" };
  }

  return null;
}

export function generateYardiId(address: string): string {
  const sanitized = address
    .replace(/[^a-zA-Z0-9]/g, "-")
    .substring(0, 30);
  return `IMPORT-${sanitized}-${Date.now()}`;
}
