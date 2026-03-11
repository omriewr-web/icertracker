/**
 * Dry-run test of address-first building matching.
 *
 * Tests realistic rent roll entity names against the buildings table
 * using both Pattern 1 (address in entity name) and Pattern 2 (address decoded from Yardi code).
 */
import { PrismaClient } from "@prisma/client";
import {
  normalizeAddress,
  extractAddressFromEntity,
  decodeYardiCode,
  findMatchingBuilding,
  fetchBuildingsForMatching,
} from "../src/lib/building-matching";

const prisma = new PrismaClient();

// Realistic entity names that match known Yardi patterns
// Pattern 1: address embedded in entity name
// Pattern 2: brand name only, code has the address
const SIMULATED_TOTAL_ROWS: { entity: string; code: string }[] = [
  // Pattern 1 — address in entity name
  { entity: "Icer of 10 West 132nd Street LLC(10w132)", code: "10w132" },
  { entity: "Atlas of 111 West 136th Street LLC(111w136)", code: "111w136" },
  { entity: "13-19 Cumming St Associate LLC(1319cumm)", code: "1319cumm" },
  { entity: "Icer of 129 Edgecombe Avenue LLC(129icer)", code: "129icer" },
  { entity: "606 St. Nicholas Ave LLC(606icer)", code: "606icer" },
  { entity: "2530 7th Ave LLC(25307th)", code: "25307th" },
  { entity: "537 Lenox Avenue, 101 West 137th Street LLC(537lenox)", code: "537lenox" },
  { entity: "Icer of 139 East 13th Street LLC(139e13th)", code: "139e13th" },
  { entity: "415 West 150th Street LLC(415w150)", code: "415w150" },
  { entity: "322 West 138th Street LLC(322w138)", code: "322w138" },

  // Pattern 2 — no address in entity, decoded from code
  { entity: "BX Hoffman LLC(2376hoff)", code: "2376hoff" },
  { entity: "BX Hoffman LLC(2378hoff)", code: "2378hoff" },
  { entity: "BX Hoffman LLC(2384hoff)", code: "2384hoff" },
  { entity: "BX Hoffman LLC(2386hoff)", code: "2386hoff" },
  { entity: "BX Hoffman LLC(2454hoff)", code: "2454hoff" },
  { entity: "BX Hoffman LLC(2464hoff)", code: "2464hoff" },
  { entity: "Fordham Portfolio I LLC(2460belm)", code: "2460belm" },
  { entity: "Fordham Portfolio I LLC(2462belm)", code: "2462belm" },
  { entity: "Fordham Portfolio I LLC(2464belm)", code: "2464belm" },
  { entity: "Fordham Portfolio I LLC(2466belm)", code: "2466belm" },
  { entity: "Fordham Portfolio I LLC(2468belm)", code: "2468belm" },
  { entity: "Fordham Portfolio I LLC(2490belm)", code: "2490belm" },
  { entity: "Fordham Portfolio I LLC(2470beau)", code: "2470beau" },
  { entity: "BX Portfolio LLC(2463hugh)", code: "2463hugh" },
  { entity: "BX Portfolio LLC(2481hugh)", code: "2481hugh" },
  { entity: "BX Portfolio LLC(2476camb)", code: "2476camb" },
  { entity: "BX Portfolio LLC(2483camb)", code: "2483camb" },
  { entity: "993 Summit Ave LLC(993sum)", code: "993sum" },
  { entity: "904 Morris Avenue LLC(904morri)", code: "904morri" },
  { entity: "Fordham Portfolio I LLC(1173tint)", code: "1173tint" },
  { entity: "Jefferson Street LLC(242jeff)", code: "242jeff" },
  { entity: "BX 9 CCP LLC(383conve)", code: "383conve" },
  { entity: "BX 9 CCP LLC(385conve)", code: "385conve" },
  { entity: "Wyckoff Partners LLC(266wyck)", code: "266wyck" },
  { entity: "Fordham Portfolio LLC(2655fdb)", code: "2655fdb" },
  { entity: "Fordham Portfolio LLC(2657fdb)", code: "2657fdb" },
];

async function main() {
  const existingBuildings = await fetchBuildingsForMatching();

  console.log(`\n=== Address-First Matching Dry Run ===\n`);
  console.log(`Buildings in DB: ${existingBuildings.length}`);
  console.log(`Simulated Total rows: ${SIMULATED_TOTAL_ROWS.length}\n`);

  const stats = { address: 0, "address-startswith": 0, "yardi-code-decoded": 0, "yardi-code-decoded-startswith": 0, yardiId: 0, entity: 0, unmatched: 0 };

  for (const row of SIMULATED_TOTAL_ROWS) {
    const extractedAddr = extractAddressFromEntity(row.entity);
    const decoded = decodeYardiCode(row.code);

    const match = findMatchingBuilding(
      { address: extractedAddr || row.entity, block: null, lot: null, entity: row.entity, yardiId: row.code },
      existingBuildings,
    );

    if (match) {
      const building = existingBuildings.find(b => b.id === match.id);
      const key = match.matchedBy as keyof typeof stats;
      if (key in stats) stats[key]++;
      console.log(`  ✓ ${match.matchedBy.padEnd(30)} ${row.code.padEnd(12)} → ${building?.address ?? "?"}`);
      if (extractedAddr) console.log(`    Pattern 1 extracted: "${extractedAddr}"`);
      if (decoded && !extractedAddr) console.log(`    Pattern 2 decoded:   "${decoded}"`);
    } else {
      stats.unmatched++;
      console.log(`  ✗ UNMATCHED                      ${row.code.padEnd(12)}   entity: "${row.entity}"`);
      console.log(`    extracted: ${extractedAddr ?? "(none)"}  decoded: ${decoded ?? "(none)"}`);
    }
  }

  console.log(`\n--- Results ---`);
  console.log(`  Address exact:               ${stats.address}`);
  console.log(`  Address starts-with:         ${stats["address-startswith"]}`);
  console.log(`  Yardi code decoded:          ${stats["yardi-code-decoded"]}`);
  console.log(`  Yardi code decoded starts:   ${stats["yardi-code-decoded-startswith"]}`);
  console.log(`  yardiId fallback:            ${stats.yardiId}`);
  console.log(`  Entity containment:          ${stats.entity}`);
  console.log(`  Unmatched:                   ${stats.unmatched}`);
  console.log(`  ──────────────────────────`);
  console.log(`  TOTAL:                       ${SIMULATED_TOTAL_ROWS.length}`);
  console.log(`  Address-first rate:          ${stats.address + stats["address-startswith"] + stats["yardi-code-decoded"] + stats["yardi-code-decoded-startswith"]}/${SIMULATED_TOTAL_ROWS.length}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
