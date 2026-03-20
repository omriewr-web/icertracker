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

/**
 * Yardi code → street name dictionary.
 * Yardi codes encode street number + abbreviated street name, e.g. "2376hoff" → 2376 Hoffman Street.
 * Used as Pattern 2 fallback when entity name doesn't contain an extractable address.
 */
const YARDI_STREET_CODES: Record<string, string> = {
  hoff: "Hoffman Street",
  belm: "Belmont Avenue",
  hugh: "Hughes Avenue",
  camb: "Cambreleng Avenue",
  beau: "Beaumont Avenue",
  wood: "Woodycrest Avenue",
  jeff: "Jefferson Street",
  conve: "Convent Avenue",
  acpb: "Adam C Powell Blvd",
  morri: "Morris Avenue",
  hopki: "Hopkinson Avenue",
  tint: "Tinton Avenue",
  cumm: "Cumming Street",
  dupon: "Dupont Street",
  eldr: "Eldridge Street",
  moffa: "Moffat Street",
  tenth: "Tenth Avenue",
  rese: "Reservoir Ave",
  long: "Longfellow Avenue",
  wyck: "Wyckoff Avenue",
  lenox: "Lenox Avenue",
  sum: "Summit Avenue",
  prince: "Prince Street",
  uni: "University Ave",
  icer: "Edgecombe Avenue",  // Icer Management buildings on Edgecombe / St. Nicholas
  fdb: "Frederick Douglass Blvd",
};

/**
 * Decode a Yardi property code into a street address.
 * e.g. "2376hoff" → "2376 Hoffman Street"
 *      "606icer" → "606" (icer maps to multiple streets, still useful with number)
 *      "10w132"  → null (directional codes handled by entity extraction instead)
 */
export function decodeYardiCode(code: string | null | undefined): string | null {
  if (!code) return null;
  // Match leading digits + trailing alpha
  const m = code.match(/^(\d+)([a-z]+)$/i);
  if (!m) return null;
  const streetNum = m[1];
  const streetAbbr = m[2].toLowerCase();
  const streetName = YARDI_STREET_CODES[streetAbbr];
  if (streetName) return `${streetNum} ${streetName}`;
  return null;
}

export function normalizeAddress(addr: string | null | undefined): string {
  if (!addr) return "";
  let result = addr.toLowerCase().trim();
  // Expand abbreviations (word-boundary match)
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    result = result.replace(new RegExp(`\\b${abbr}\\.?\\b`, "g"), full);
  }
  // Collapse whitespace, strip non-alphanumeric (except spaces)
  result = result.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return result;
}

export function normalizeBlockLot(val: string | null | undefined): string {
  if (!val) return "";
  return val.replace(/^0+/, "").trim();
}

export function normalizeEntity(entity: string | null | undefined): string {
  if (!entity) return "";
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
  yardiId?: string | null;
}

interface ExistingBuilding {
  id: string;
  address: string;
  block: string | null;
  lot: string | null;
  entity: string | null;
  yardiId: string;
  yardiCode: string | null;
  propertyId: string | null;
}

/**
 * Match a building candidate against existing buildings.
 *
 * Priority (address-first, software-agnostic):
 *   1. Exact normalized address match (from entity name extraction)
 *   2. Starts-with address match (handles partial addresses)
 *   3. Decoded Yardi code → address match (Pattern 2: "2376hoff" → "2376 Hoffman Street")
 *   4. Block+lot match
 *   5. yardiCode / yardiId exact match (fallback only)
 *   6. Entity name containment match
 */
export function findMatchingBuilding(
  candidate: BuildingCandidate | null | undefined,
  existingBuildings: ExistingBuilding[] | null | undefined
): { id: string; matchedBy: string } | null {
  if (!candidate || !existingBuildings) return null;

  // ── 1. Exact normalized address match ──
  const normAddr = normalizeAddress(candidate.address);
  if (normAddr.length >= 5) {
    const exactMatch = existingBuildings.find(
      (b) => normalizeAddress(b.address) === normAddr
    );
    if (exactMatch) return { id: exactMatch.id, matchedBy: "address" };
  }

  // ── 2. Starts-with address match ──
  if (normAddr.length >= 8) {
    const startsWithMatch = existingBuildings.find((b) => {
      const normB = normalizeAddress(b.address);
      return normB.startsWith(normAddr) || normAddr.startsWith(normB);
    });
    if (startsWithMatch) return { id: startsWithMatch.id, matchedBy: "address-startswith" };
  }

  // ── 3. Decode Yardi code → address (Pattern 2) ──
  if (candidate.yardiId) {
    const decoded = decodeYardiCode(candidate.yardiId);
    if (decoded) {
      const normDecoded = normalizeAddress(decoded);
      const decodedExact = existingBuildings.find(
        (b) => normalizeAddress(b.address) === normDecoded
      );
      if (decodedExact) return { id: decodedExact.id, matchedBy: "yardi-code-decoded" };

      // Starts-with on decoded address
      const decodedStartsWith = existingBuildings.find((b) => {
        const normB = normalizeAddress(b.address);
        return normB.startsWith(normDecoded) || normDecoded.startsWith(normB);
      });
      if (decodedStartsWith) return { id: decodedStartsWith.id, matchedBy: "yardi-code-decoded-startswith" };
    }
  }

  // ── 4. Block+lot match ──
  if (candidate.block && candidate.lot) {
    const normBlock = normalizeBlockLot(candidate.block);
    const normLot = normalizeBlockLot(candidate.lot);
    const match = existingBuildings.find(
      (b) =>
        b.block && b.lot &&
        normalizeBlockLot(b.block) === normBlock &&
        normalizeBlockLot(b.lot) === normLot
    );
    if (match) return { id: match.id, matchedBy: "block+lot" };
  }

  // ── 5. propertyId / yardiCode / yardiId exact match (fallback) ──
  if (candidate.yardiId) {
    const codeLower = candidate.yardiId.toLowerCase();
    const codeMatch = existingBuildings.find(
      (b) =>
        (b.propertyId && b.propertyId.toLowerCase() === codeLower) ||
        (b.yardiCode && b.yardiCode.toLowerCase() === codeLower) ||
        b.yardiId.toLowerCase() === codeLower
    );
    if (codeMatch) return { id: codeMatch.id, matchedBy: "propertyId" };
  }

  // ── 6. Entity name containment match ──
  if (candidate.entity) {
    const normEntity = normalizeEntity(candidate.entity);
    if (normEntity) {
      const entityMatch = existingBuildings.find(
        (b) =>
          b.entity &&
          (() => {
            const normExisting = normalizeEntity(b.entity!);
            return normExisting.includes(normEntity) || normEntity.includes(normExisting);
          })()
      );
      if (entityMatch) return { id: entityMatch.id, matchedBy: "entity" };
    }
  }

  return null;
}

export async function fetchBuildingsForMatching(organizationId?: string | null) {
  return prisma.building.findMany({
    where: organizationId ? { organizationId } : {},
    select: {
      id: true,
      address: true,
      block: true,
      lot: true,
      entity: true,
      yardiId: true,
      yardiCode: true,
      propertyId: true,
    },
  });
}

/**
 * Extract a street address from an entity-style building name.
 * e.g. "Atlas of 111 West 136th Street LLC(111w136)" → "111 West 136th Street"
 *      "1776 Castle Hill Apt Owners, LLC(1776cast)" → "1776 Castle Hill"
 */
export function extractAddressFromEntity(name: string | null | undefined): string | null {
  if (!name) return null;
  // Remove yardiId parenthesized suffix
  let clean = name.replace(/\([^)]+\)$/, "").trim();
  // Remove LLC/Inc/etc and common suffixes
  clean = clean
    .replace(/\s*[-–]\s*(Rental|Coop|Co-op|Commercial)\s*$/i, "")
    .replace(/\s*&\s*CULLEN\s+PROPERTY\s+\d+/i, "")
    .replace(/,?\s*(L\.?L\.?C\.?|LLC|Inc\.?|Corp\.?|LP|Associates?|Associate|Group|Holdings?|Holding|Management|Owners?|Properties|Property|Realty|Ltd\.?|Co\.?,?\s*Ltd\.?)\s*$/gi, "")
    .replace(/,?\s*(L\.?L\.?C\.?|LLC|Inc\.?|Corp\.?|LP|Associates?|Associate|Group|Holdings?|Holding|Management|Owners?|Properties|Property|Realty|Ltd\.?|Co\.?,?\s*Ltd\.?)\s*$/gi, "")
    .replace(/\s+Apt\s+Owners?\s*$/i, "")
    .trim()
    .replace(/,\s*$/, "")
    .replace(/\s*&\s*$/, "")
    .trim();
  // Remove common entity prefixes before an address (e.g. "Atlas of", "Icer of", "Rebar")
  clean = clean
    .replace(/^[A-Za-z]+\s+of\s+/i, "")
    .replace(/^Rebar\s+/i, "")
    .trim();
  // Must start with a number to be a street address
  if (/^\d/.test(clean)) return clean;
  return null;
}

/**
 * Get the best display address for a building, preferring altAddress over extracted address over raw address.
 */
export function getDisplayAddress(building: { address: string; altAddress?: string | null } | null | undefined): string {
  if (!building) return "";
  if (building.altAddress?.trim()) return building.altAddress.trim();
  return extractAddressFromEntity(building.address) || building.address;
}

/**
 * Match a building row (with block/lot/buildingId) against existing buildings.
 * Priority: 1) block+lot  2) normalized address  3) yardiId/building_id
 */
export function matchBuildingByRow(
  row: { address: string; block?: string | null; lot?: string | null; buildingId?: string | null } | null | undefined,
  existing: Array<{ id: string; address: string; block: string | null; lot: string | null; yardiId: string }> | null | undefined
): { id: string; matchedBy: string } | null {
  if (!row || !existing) return null;

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

export function generateYardiId(address: string | null | undefined): string {
  if (!address) return `IMPORT-unknown-${Date.now()}`;
  const sanitized = address
    .replace(/[^a-zA-Z0-9]/g, "-")
    .substring(0, 30);
  return `IMPORT-${sanitized}-${Date.now()}`;
}

/**
 * Generate a human-readable, URL-safe property ID from a street address.
 * e.g. "10 West 132nd Street" → "10-west-132nd"
 *      "2376 Hoffman Street"  → "2376-hoffman"
 *      "537 Lenox Avenue, 101 West 137th Street" → "537-lenox"
 *
 * Takes street number + first meaningful street word(s), drops suffix (Street/Avenue/etc).
 */
export function generatePropertyId(address: string | null | undefined): string {
  if (!address) return "unknown";
  const norm = address.toLowerCase().trim();
  // Take text before first comma (multi-address buildings)
  const primary = norm.split(",")[0].trim();
  // Remove suffixes
  const stripped = primary
    .replace(/\b(street|avenue|ave|boulevard|blvd|road|rd|drive|dr|place|pl|court|ct|lane|ln)\b\.?/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Split into tokens, take number + street name parts
  const tokens = stripped.split(" ").filter(Boolean);
  // Join with hyphens, cap at 30 chars
  return tokens.join("-").substring(0, 30).replace(/-$/, "");
}
