/**
 * Populate legalRent on vacant units using building-level averages
 * from occupied units' tenant rent data.
 *
 * Logic:
 *   1. For each building with vacant units, compute the average
 *      max(tenant.legalRent, tenant.marketRent) from occupied units.
 *   2. Set unit.legalRent = building average for each vacant unit
 *      where approvedRent, proposedRent, askingRent, AND legalRent are all null.
 *   3. Uses a Prisma transaction to batch update.
 *
 * Run: npx tsx scripts/populate-legal-rent.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Find all vacant residential units missing ALL rent fields
  const vacantUnits = await prisma.unit.findMany({
    where: {
      isVacant: true,
      isResidential: true,
      approvedRent: null,
      proposedRent: null,
      askingRent: null,
      legalRent: null,
    },
    select: { id: true, unitNumber: true, buildingId: true },
  });

  if (vacantUnits.length === 0) {
    console.log("No vacant units need legalRent populated. Done.");
    return;
  }

  console.log(`Found ${vacantUnits.length} vacant units with no rent data.`);

  // 2. Get all unique buildings these units belong to
  const buildingIds = [...new Set(vacantUnits.map((u) => u.buildingId))];

  // 3. For each building, compute average rent from occupied tenants
  const buildingAvgRent = new Map<string, number>();

  for (const buildingId of buildingIds) {
    const tenants = await prisma.tenant.findMany({
      where: {
        unit: { buildingId, isVacant: false, isResidential: true },
      },
      select: { legalRent: true, marketRent: true },
    });

    if (tenants.length > 0) {
      const rents = tenants.map((t) =>
        Math.max(Number(t.legalRent) || 0, Number(t.marketRent) || 0)
      ).filter((r) => r > 0);

      if (rents.length > 0) {
        const avg = rents.reduce((a, b) => a + b, 0) / rents.length;
        buildingAvgRent.set(buildingId, Math.round(avg * 100) / 100);
      }
    }
  }

  // 4. Build update operations
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  let updatedCount = 0;
  let skippedCount = 0;

  for (const unit of vacantUnits) {
    const avgRent = buildingAvgRent.get(unit.buildingId);
    if (avgRent && avgRent > 0) {
      updates.push(
        prisma.unit.update({
          where: { id: unit.id },
          data: { legalRent: new Prisma.Decimal(avgRent) },
        })
      );
      updatedCount++;
    } else {
      console.log(`  SKIP unit ${unit.id} (${unit.unitNumber}) — no rent data in building`);
      skippedCount++;
    }
  }

  if (updates.length === 0) {
    console.log("No updates to make — no buildings had rent data. Done.");
    return;
  }

  // 5. Execute in transaction
  console.log(`\nApplying ${updates.length} updates in a single transaction...`);
  await prisma.$transaction(updates);

  console.log(`\nDone.`);
  console.log(`  Updated: ${updatedCount} units (legalRent set to building average)`);
  console.log(`  Skipped: ${skippedCount} units (no building rent data)`);

  // 6. Verify
  const stillNull = await prisma.unit.count({
    where: {
      isVacant: true,
      isResidential: true,
      legalRent: null,
      approvedRent: null,
      proposedRent: null,
      askingRent: null,
    },
  });
  console.log(`  Remaining vacant units with no rent: ${stillNull}`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
