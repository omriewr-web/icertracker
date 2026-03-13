/**
 * Backfill Lease records from existing Tenant data.
 *
 * Rules:
 * - Idempotent: skips tenants that already have a Lease with id `{tenantId}-lease`
 * - Creates one "current" lease per tenant
 * - Derives lease fields from Tenant.moveInDate, leaseExpiration, marketRent, etc.
 * - Logs rows that cannot be safely inferred
 * - Uses pgbouncer URL with connection_limit=1 (per Supabase best practice)
 *
 * Usage: npx tsx scripts/backfill-leases.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";

const dryRun = process.argv.includes("--dry-run");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ["warn", "error"],
});

async function main() {
  console.log(`Backfill Leases — ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log("=".repeat(60));

  // Fetch all tenants with their unit and building info
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      unitId: true,
      name: true,
      marketRent: true,
      legalRent: true,
      prefRent: true,
      deposit: true,
      moveInDate: true,
      leaseExpiration: true,
      moveOutDate: true,
      isStabilized: true,
      unit: {
        select: {
          buildingId: true,
          building: { select: { organizationId: true } },
        },
      },
    },
  });

  console.log(`Found ${tenants.length} tenants`);

  // Fetch existing lease IDs to skip duplicates
  const existingLeases = await prisma.lease.findMany({
    where: {
      id: { in: tenants.map((t) => `${t.id}-lease`) },
    },
    select: { id: true },
  });
  const existingLeaseIds = new Set(existingLeases.map((l) => l.id));
  console.log(`Found ${existingLeaseIds.size} existing leases (will be skipped)`);

  let created = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (const t of tenants) {
    const leaseId = `${t.id}-lease`;

    if (existingLeaseIds.has(leaseId)) {
      skipped++;
      continue;
    }

    // Derive status
    let status: string;
    if (t.moveOutDate) {
      status = "TERMINATED";
    } else if (t.leaseExpiration) {
      status = t.leaseExpiration < new Date() ? "EXPIRED" : "ACTIVE";
    } else {
      status = "MONTH_TO_MONTH";
    }

    const isCurrent = status === "ACTIVE" || status === "MONTH_TO_MONTH";

    // Warn if we can't infer much
    if (!t.moveInDate && !t.leaseExpiration && Number(t.marketRent) === 0) {
      warnings.push(
        `Tenant ${t.id} ("${t.name}"): no moveInDate, no leaseExpiration, zero rent — creating minimal lease`,
      );
    }

    if (!dryRun) {
      await prisma.lease.create({
        data: {
          id: leaseId,
          organizationId: t.unit.building?.organizationId ?? null,
          buildingId: t.unit.buildingId,
          unitId: t.unitId,
          tenantId: t.id,
          isCurrent,
          leaseStart: t.moveInDate,
          leaseEnd: t.leaseExpiration,
          moveInDate: t.moveInDate,
          moveOutDate: t.moveOutDate,
          monthlyRent: t.marketRent,
          legalRent: t.legalRent,
          preferentialRent: t.prefRent,
          securityDeposit: t.deposit,
          isStabilized: t.isStabilized,
          status: status as any,
        },
      });
    }

    created++;
  }

  console.log("\n" + "=".repeat(60));
  console.log(
    `Results: ${created} ${dryRun ? "would be created" : "created"}, ${skipped} skipped (already had lease)`,
  );

  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`  - ${w}`);
    }
  }

  console.log(dryRun ? "\n(Dry run — no changes made)" : "\nDone.");
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
