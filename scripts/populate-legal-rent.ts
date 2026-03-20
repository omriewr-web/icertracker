/**
 * Populate legalRent on vacant units from the best available source.
 *
 * Rent source hierarchy (per unit):
 *   1. Unit's own tenant — max(tenant.marketRent, tenant.legalRent)
 *      (tenant record often still linked even after move-out)
 *   2. DhcrRent table — matched by [buildingId, unitNumber]
 *   3. Building average — avg of occupied tenants' max(marketRent, legalRent)
 *
 * Only updates units where ALL four rent fields are null:
 *   approvedRent, proposedRent, askingRent, legalRent
 *
 * Run: npx tsx scripts/populate-legal-rent.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Find all vacant residential units where no rent field has a usable value
  //    (null or zero both mean "not set" for the lost rent calculation)
  const allVacant = await prisma.unit.findMany({
    where: {
      isVacant: true,
      isResidential: true,
    },
    select: {
      id: true,
      unitNumber: true,
      buildingId: true,
      legalRent: true,
      askingRent: true,
      proposedRent: true,
      approvedRent: true,
      tenant: { select: { marketRent: true, legalRent: true } },
    },
  });

  // Filter to only units where the entire rent chain resolves to 0
  const vacantUnits = allVacant.filter((u) => {
    const rent =
      (Number(u.approvedRent) || 0) ||
      (Number(u.proposedRent) || 0) ||
      (Number(u.askingRent) || 0) ||
      (Number(u.legalRent) || 0);
    return rent === 0;
  });

  if (vacantUnits.length === 0) {
    console.log("No vacant units need legalRent populated. Done.");
    return;
  }

  console.log(`Found ${vacantUnits.length} vacant units with no usable rent data.\n`);

  // 2. Load DHCR rent data for all relevant buildings
  const buildingIds = [...new Set(vacantUnits.map((u) => u.buildingId))];
  const dhcrRents = await prisma.dhcrRent.findMany({
    where: { buildingId: { in: buildingIds } },
    select: { buildingId: true, unitNumber: true, legalRent: true },
  });
  const dhcrMap = new Map<string, number>();
  for (const d of dhcrRents) {
    const key = `${d.buildingId}:${d.unitNumber.toLowerCase().trim()}`;
    dhcrMap.set(key, Number(d.legalRent));
  }

  // 3. Compute building-level average rent as fallback
  const buildingAvgRent = new Map<string, number>();
  for (const buildingId of buildingIds) {
    const tenants = await prisma.tenant.findMany({
      where: {
        unit: { buildingId, isVacant: false, isResidential: true },
      },
      select: { legalRent: true, marketRent: true },
    });

    if (tenants.length > 0) {
      const rents = tenants
        .map((t) => Math.max(Number(t.legalRent) || 0, Number(t.marketRent) || 0))
        .filter((r) => r > 0);

      if (rents.length > 0) {
        const avg = rents.reduce((a, b) => a + b, 0) / rents.length;
        buildingAvgRent.set(buildingId, Math.round(avg * 100) / 100);
      }
    }
  }

  // 4. Determine rent for each unit using hierarchy
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  let fromTenant = 0;
  let fromDhcr = 0;
  let fromAvg = 0;
  let skipped = 0;

  for (const unit of vacantUnits) {
    let rent = 0;
    let source = "";

    // Source 1: Unit's own tenant
    if (unit.tenant) {
      const tr = Math.max(Number(unit.tenant.marketRent) || 0, Number(unit.tenant.legalRent) || 0);
      if (tr > 0) {
        rent = tr;
        source = "tenant";
      }
    }

    // Source 2: DHCR rent
    if (rent === 0) {
      const dhcrKey = `${unit.buildingId}:${unit.unitNumber.toLowerCase().trim()}`;
      const dhcrRent = dhcrMap.get(dhcrKey);
      if (dhcrRent && dhcrRent > 0) {
        rent = dhcrRent;
        source = "dhcr";
      }
    }

    // Source 3: Building average
    if (rent === 0) {
      const avg = buildingAvgRent.get(unit.buildingId);
      if (avg && avg > 0) {
        rent = avg;
        source = "building-avg";
      }
    }

    if (rent > 0) {
      updates.push(
        prisma.unit.update({
          where: { id: unit.id },
          data: { legalRent: new Prisma.Decimal(rent) },
        })
      );
      if (source === "tenant") fromTenant++;
      else if (source === "dhcr") fromDhcr++;
      else fromAvg++;
      console.log(`  SET ${unit.unitNumber} → $${rent.toFixed(2)} (${source})`);
    } else {
      console.log(`  SKIP ${unit.unitNumber} — no rent data available`);
      skipped++;
    }
  }

  if (updates.length === 0) {
    console.log("\nNo updates to make — no rent data found anywhere. Done.");
    return;
  }

  // 5. Execute in transaction
  console.log(`\nApplying ${updates.length} updates in a single transaction...`);
  await prisma.$transaction(updates);

  console.log(`\nDone.`);
  console.log(`  From tenant record:   ${fromTenant}`);
  console.log(`  From DHCR:            ${fromDhcr}`);
  console.log(`  From building avg:    ${fromAvg}`);
  console.log(`  Skipped (no data):    ${skipped}`);
  console.log(`  Total updated:        ${updates.length}`);

  // 6. Verify — recheck how many vacant units still resolve to $0
  const recheck = await prisma.unit.findMany({
    where: { isVacant: true, isResidential: true },
    select: { legalRent: true, askingRent: true, proposedRent: true, approvedRent: true },
  });
  const stillZero = recheck.filter((u) => {
    const r =
      (Number(u.approvedRent) || 0) ||
      (Number(u.proposedRent) || 0) ||
      (Number(u.askingRent) || 0) ||
      (Number(u.legalRent) || 0);
    return r === 0;
  }).length;
  console.log(`\n  Remaining vacant units with $0 rent: ${stillZero}`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
