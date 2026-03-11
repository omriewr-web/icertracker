/**
 * Map Yardi property codes to buildings.
 *
 * Usage:
 *   npx tsx scripts/map-yardi-codes.ts              # Dry run — show matches
 *   npx tsx scripts/map-yardi-codes.ts --save       # Write yardiCode to DB
 *
 * If a rent roll file is provided, extracts codes from Total rows and matches
 * by address. Otherwise, copies existing yardiId values (which already contain
 * real Yardi codes) to the yardiCode field.
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();
const save = process.argv.includes("--save");
const filePath = process.argv.find((a) => a.endsWith(".xlsx"));

// ── Address normalization (mirrors building-matching.ts) ──
const ABBREVIATIONS: Record<string, string> = {
  st: "street", ave: "avenue", blvd: "boulevard", dr: "drive",
  rd: "road", pl: "place", ct: "court", ln: "lane",
};

function normalizeAddress(addr: string): string {
  let result = addr.toLowerCase().trim();
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    result = result.replace(new RegExp(`\\b${abbr}\\.?\\b`, "g"), full);
  }
  return result.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function extractAddressFromEntity(name: string): string | null {
  let clean = name.replace(/\([^)]+\)$/, "").trim();
  clean = clean
    .replace(/\s*[-–]\s*(Rental|Coop|Co-op|Commercial)\s*$/i, "")
    .replace(/,?\s*(L\.?L\.?C\.?|LLC|Inc\.?|Corp\.?|LP|Associates?|Group|Holdings?|Holding|Management|Owners?|Properties|Property|Realty|Ltd\.?|Co\.?,?\s*Ltd\.?)\s*$/gi, "")
    .replace(/,?\s*(L\.?L\.?C\.?|LLC|Inc\.?|Corp\.?|LP|Associates?|Group|Holdings?|Holding|Management|Owners?|Properties|Property|Realty|Ltd\.?|Co\.?,?\s*Ltd\.?)\s*$/gi, "")
    .trim().replace(/,\s*$/, "").replace(/\s*&\s*$/, "").trim();
  clean = clean.replace(/^[A-Za-z]+\s+of\s+/i, "").replace(/^Rebar\s+/i, "").trim();
  if (/^\d/.test(clean)) return clean;
  return null;
}

interface CodeEntry {
  code: string;
  entity: string;
  extractedAddr: string | null;
}

// ── Extract codes from rent roll file (if provided) ──
function extractCodesFromFile(path: string): CodeEntry[] {
  const buffer = fs.readFileSync(path);
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === "report1") ?? wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const codes: CodeEntry[] = [];
  for (let i = 7; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r) continue;
    const col3 = String(r[3] ?? "").trim();
    if (col3.toLowerCase() !== "total") continue;
    const col4 = String(r[4] ?? "").trim();
    const m = col4.match(/\(([A-Za-z0-9]{2,20})\)/);
    if (m) {
      codes.push({
        code: m[1].trim(),
        entity: col4,
        extractedAddr: extractAddressFromEntity(col4),
      });
    }
  }
  return codes;
}

async function main() {
  const buildings = await prisma.building.findMany({
    select: { id: true, address: true, yardiId: true, yardiCode: true },
    orderBy: { address: "asc" },
  });

  console.log(`\n=== Yardi Code Mapping ${save ? "(SAVE MODE)" : "(DRY RUN)"} ===\n`);
  console.log(`Buildings in DB: ${buildings.length}`);

  let matched = 0;
  let unmatched = 0;
  let alreadyMapped = 0;
  const updates: { id: string; yardiCode: string; address: string; method: string }[] = [];

  if (filePath) {
    // ── Mode 1: Extract codes from rent roll file and match by address ──
    console.log(`Rent roll file: ${filePath}\n`);
    const codes = extractCodesFromFile(filePath);
    console.log(`Total rows found: ${codes.length}\n`);

    for (const entry of codes) {
      // Try exact yardiId match first
      let building = buildings.find((b) => b.yardiId.toLowerCase() === entry.code.toLowerCase());
      let method = "yardiId";

      // Try address match
      if (!building && entry.extractedAddr) {
        const normAddr = normalizeAddress(entry.extractedAddr);
        building = buildings.find((b) => normalizeAddress(b.address) === normAddr);
        if (!building) {
          // Fuzzy: containment
          building = buildings.find((b) => {
            const normB = normalizeAddress(b.address);
            return normB.includes(normAddr) || normAddr.includes(normB);
          });
          method = building ? "address-fuzzy" : "";
        } else {
          method = "address";
        }
      }

      if (building) {
        if (building.yardiCode) {
          alreadyMapped++;
          console.log(`  ✓ ALREADY  ${entry.code.padEnd(12)} → ${building.address}`);
        } else {
          matched++;
          updates.push({ id: building.id, yardiCode: entry.code, address: building.address, method });
          console.log(`  ✓ MATCH    ${entry.code.padEnd(12)} → ${building.address.padEnd(40)} (via ${method})`);
        }
      } else {
        unmatched++;
        console.log(`  ✗ MISSED   ${entry.code.padEnd(12)}   entity: ${entry.entity}`);
        console.log(`             ${" ".repeat(12)}   addr:   ${entry.extractedAddr ?? "(none)"}`);
      }
    }
  } else {
    // ── Mode 2: Copy yardiId → yardiCode (codes already present) ──
    console.log(`No rent roll file provided — copying yardiId → yardiCode\n`);

    for (const b of buildings) {
      if (b.yardiCode) {
        alreadyMapped++;
        console.log(`  ✓ ALREADY  ${b.yardiId.padEnd(15)} → ${b.address}`);
      } else if (b.yardiId && !b.yardiId.startsWith("IMPORT-")) {
        matched++;
        updates.push({ id: b.id, yardiCode: b.yardiId, address: b.address, method: "yardiId-copy" });
        console.log(`  ✓ MATCH    ${b.yardiId.padEnd(15)} → ${b.address}`);
      } else {
        unmatched++;
        console.log(`  ✗ MISSED   ${b.yardiId.padEnd(15)}   ${b.address} (auto-generated ID)`);
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Matched:        ${matched}`);
  console.log(`  Already mapped: ${alreadyMapped}`);
  console.log(`  Unmatched:      ${unmatched}`);
  console.log(`  Total updates:  ${updates.length}`);

  if (save && updates.length > 0) {
    console.log(`\nWriting ${updates.length} yardiCode values...`);
    for (const u of updates) {
      await prisma.building.update({
        where: { id: u.id },
        data: { yardiCode: u.yardiCode },
      });
    }
    console.log("Done — all yardiCodes saved.");
  } else if (!save && updates.length > 0) {
    console.log(`\nRun with --save to write these to the database.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
