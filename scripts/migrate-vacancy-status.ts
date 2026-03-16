/**
 * Backfill vacancyStatus for all existing vacant units based on their
 * active TurnoverWorkflow status (if any).
 *
 * Usage: npx tsx scripts/migrate-vacancy-status.ts
 */
import { PrismaClient, VacancyStatus, TurnoverStatus } from "@prisma/client";

const prisma = new PrismaClient();

const TURNOVER_TO_VACANCY: Record<TurnoverStatus, VacancyStatus> = {
  PENDING_INSPECTION: "PRE_TURNOVER",
  INSPECTION_DONE: "TURNOVER",
  SCOPE_CREATED: "TURNOVER",
  VENDORS_ASSIGNED: "TURNOVER",
  READY_TO_LIST: "READY_TO_SHOW",
  LISTED: "LISTED",
  COMPLETE: "OCCUPIED",
};

async function main() {
  console.log("Starting vacancy status migration...\n");

  // Get all vacant units with their active turnovers
  const vacantUnits = await prisma.unit.findMany({
    where: { isVacant: true },
    select: {
      id: true,
      unitNumber: true,
      building: { select: { address: true } },
      turnoverWorkflows: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true },
      },
    },
  });

  const counts: Record<string, number> = {};
  let updated = 0;

  for (const unit of vacantUnits) {
    const turnover = unit.turnoverWorkflows[0];
    let newStatus: VacancyStatus;

    if (turnover) {
      newStatus = TURNOVER_TO_VACANCY[turnover.status];
    } else {
      newStatus = "VACANT";
    }

    // If COMPLETE → mark as OCCUPIED and set isVacant=false
    if (newStatus === "OCCUPIED") {
      await prisma.unit.update({
        where: { id: unit.id },
        data: {
          vacancyStatus: "OCCUPIED",
          isVacant: false,
          statusChangedAt: new Date(),
        },
      });
    } else {
      await prisma.unit.update({
        where: { id: unit.id },
        data: {
          vacancyStatus: newStatus,
          statusChangedAt: new Date(),
        },
      });
    }

    counts[newStatus] = (counts[newStatus] || 0) + 1;
    updated++;
  }

  console.log(`Updated ${updated} units:\n`);
  for (const [status, count] of Object.entries(counts).sort()) {
    console.log(`  ${status}: ${count}`);
  }
  console.log("\nMigration complete.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
