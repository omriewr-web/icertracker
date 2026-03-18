/**
 * AtlasPM Demo Reset — removes all data created by seed-demo.ts
 * Run: npm run reset:demo
 *
 * Deletes in foreign key order. Does NOT touch real data or the admin user.
 * Identifies demo data by: org slug "icer-demo", yardiId prefix "demo-",
 * username prefix "demo-", violation externalId prefix "HPD-DEMO-".
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Resetting demo data...\n");

  // Find demo org
  const org = await prisma.organization.findUnique({ where: { slug: "icer-demo" } });
  if (!org) {
    console.log("  No demo org found (slug: icer-demo). Nothing to reset.");
    return;
  }

  // Find demo buildings
  const demoBuildings = await prisma.building.findMany({
    where: { yardiId: { startsWith: "demo-" } },
    select: { id: true, address: true },
  });
  const buildingIds = demoBuildings.map((b) => b.id);

  // Find demo users
  const demoUsers = await prisma.user.findMany({
    where: { username: { startsWith: "demo-" } },
    select: { id: true, username: true },
  });
  const userIds = demoUsers.map((u) => u.id);

  // Find demo tenants (in demo buildings)
  const demoTenants = buildingIds.length > 0
    ? await prisma.tenant.findMany({
        where: { unit: { buildingId: { in: buildingIds } } },
        select: { id: true },
      })
    : [];
  const tenantIds = demoTenants.map((t) => t.id);

  // Find demo units
  const demoUnits = buildingIds.length > 0
    ? await prisma.unit.findMany({
        where: { buildingId: { in: buildingIds } },
        select: { id: true },
      })
    : [];
  const unitIds = demoUnits.map((u) => u.id);

  const counts: Record<string, number> = {};

  // ── Delete in FK order (leaf tables first) ──

  // 1. Collection notes (FK: tenant, building, author)
  if (tenantIds.length > 0) {
    const r = await prisma.collectionNote.deleteMany({ where: { tenantId: { in: tenantIds } } });
    counts["CollectionNote"] = r.count;
  }

  // 2. Payments (FK: tenant, recorder)
  if (tenantIds.length > 0) {
    const r = await prisma.payment.deleteMany({ where: { tenantId: { in: tenantIds } } });
    counts["Payment"] = r.count;
  }

  // 3. Tenant notes (FK: tenant, author)
  if (tenantIds.length > 0) {
    const r = await prisma.tenantNote.deleteMany({ where: { tenantId: { in: tenantIds } } });
    counts["TenantNote"] = r.count;
  }

  // 4. Legal cases (FK: tenant, building, unit, collectionCase)
  if (tenantIds.length > 0) {
    const r = await prisma.legalCase.deleteMany({ where: { tenantId: { in: tenantIds } } });
    counts["LegalCase"] = r.count;
  }

  // 5. Collection cases (FK: tenant, building, unit)
  if (tenantIds.length > 0) {
    const r = await prisma.collectionCase.deleteMany({ where: { tenantId: { in: tenantIds } } });
    counts["CollectionCase"] = r.count;
  }

  // 6. Work order comments + activities (FK: workOrder)
  if (buildingIds.length > 0) {
    const demoWOs = await prisma.workOrder.findMany({
      where: { buildingId: { in: buildingIds } },
      select: { id: true },
    });
    const woIds = demoWOs.map((w) => w.id);
    if (woIds.length > 0) {
      const r1 = await prisma.workOrderComment.deleteMany({ where: { workOrderId: { in: woIds } } });
      counts["WorkOrderComment"] = r1.count;
      const r2 = await prisma.workOrderActivity.deleteMany({ where: { workOrderId: { in: woIds } } });
      counts["WorkOrderActivity"] = r2.count;
      const r3 = await prisma.evidence.deleteMany({ where: { workOrderId: { in: woIds } } });
      counts["Evidence"] = r3.count;
    }
  }

  // 7. Work orders (FK: building, unit, violation)
  if (buildingIds.length > 0) {
    const r = await prisma.workOrder.deleteMany({ where: { buildingId: { in: buildingIds } } });
    counts["WorkOrder"] = r.count;
  }

  // 8. Violations (identified by externalId prefix)
  const vr = await prisma.violation.deleteMany({ where: { externalId: { startsWith: "HPD-DEMO-" } } });
  counts["Violation"] = vr.count;

  // 9. Activity events (FK: building, unit, tenant)
  if (buildingIds.length > 0) {
    const r = await prisma.activityEvent.deleteMany({ where: { buildingId: { in: buildingIds } } });
    counts["ActivityEvent"] = r.count;
  }

  // 10. AR snapshots
  if (buildingIds.length > 0) {
    const r = await prisma.aRSnapshot.deleteMany({ where: { buildingId: { in: buildingIds } } });
    counts["ARSnapshot"] = r.count;
  }

  // 11. Balance snapshots
  if (tenantIds.length > 0) {
    const r = await prisma.balanceSnapshot.deleteMany({ where: { tenantId: { in: tenantIds } } });
    counts["BalanceSnapshot"] = r.count;
  }

  // 12. Leases
  if (buildingIds.length > 0) {
    const r = await prisma.lease.deleteMany({ where: { buildingId: { in: buildingIds } } });
    counts["Lease"] = r.count;
  }

  // 13. Tenants (FK: unit)
  if (tenantIds.length > 0) {
    const r = await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    counts["Tenant"] = r.count;
  }

  // 14. Units (FK: building, cascade deletes handled above)
  if (unitIds.length > 0) {
    const r = await prisma.unit.deleteMany({ where: { id: { in: unitIds } } });
    counts["Unit"] = r.count;
  }

  // 15. User-property assignments for demo users
  if (userIds.length > 0) {
    const r = await prisma.userProperty.deleteMany({ where: { userId: { in: userIds } } });
    counts["UserProperty"] = r.count;
  }

  // 16. Buildings (identified by yardiId prefix)
  if (buildingIds.length > 0) {
    const r = await prisma.building.deleteMany({ where: { id: { in: buildingIds } } });
    counts["Building"] = r.count;
  }

  // 17. Demo users
  if (userIds.length > 0) {
    const r = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    counts["User"] = r.count;
  }

  // 18. Demo org
  await prisma.organization.delete({ where: { slug: "icer-demo" } }).catch(() => {});
  counts["Organization"] = 1;

  // ── Summary ──
  console.log("  Deleted:");
  for (const [table, count] of Object.entries(counts)) {
    if (count > 0) console.log(`    ${table}: ${count}`);
  }

  console.log("\n✅ Reset complete — ready for real onboarding\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
