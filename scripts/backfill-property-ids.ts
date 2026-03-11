/**
 * Backfill propertyId for all buildings that don't have one.
 *
 * Usage:
 *   npx tsx scripts/backfill-property-ids.ts          # Dry run
 *   npx tsx scripts/backfill-property-ids.ts --save    # Write to DB
 */
import { PrismaClient } from "@prisma/client";
import { generatePropertyId } from "../src/lib/building-matching";

const prisma = new PrismaClient();
const save = process.argv.includes("--save");

async function main() {
  const buildings = await prisma.building.findMany({
    select: { id: true, address: true, propertyId: true },
    orderBy: { address: "asc" },
  });

  console.log(`\n=== Property ID Backfill ${save ? "(SAVE)" : "(DRY RUN)"} ===\n`);
  console.log(`Buildings: ${buildings.length}\n`);

  const usedIds = new Set<string>();
  let generated = 0;
  let skipped = 0;
  let conflicts = 0;

  // Collect existing propertyIds first
  for (const b of buildings) {
    if (b.propertyId) usedIds.add(b.propertyId);
  }

  const updates: { id: string; propertyId: string }[] = [];

  for (const b of buildings) {
    if (b.propertyId) {
      console.log(`  SKIP     ${b.propertyId.padEnd(30)} ← ${b.address} (already set)`);
      skipped++;
      continue;
    }

    let pid = generatePropertyId(b.address);

    // Ensure uniqueness — append suffix if collision
    if (usedIds.has(pid)) {
      let suffix = 2;
      while (usedIds.has(`${pid}-${suffix}`)) suffix++;
      const original = pid;
      pid = `${pid}-${suffix}`;
      conflicts++;
      console.log(`  CONFLICT ${original} → ${pid}`);
    }

    usedIds.add(pid);
    updates.push({ id: b.id, propertyId: pid });
    generated++;
    console.log(`  GEN      ${pid.padEnd(30)} ← ${b.address}`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Generated: ${generated}`);
  console.log(`  Skipped:   ${skipped} (already have propertyId)`);
  console.log(`  Conflicts: ${conflicts} (resolved with suffix)`);

  if (save && updates.length > 0) {
    console.log(`\nWriting ${updates.length} propertyIds...`);
    for (const u of updates) {
      await prisma.building.update({
        where: { id: u.id },
        data: { propertyId: u.propertyId },
      });
    }
    console.log("Done.");
  } else if (!save && updates.length > 0) {
    console.log(`\nRun with --save to write to database.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
