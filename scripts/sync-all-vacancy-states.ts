/**
 * Sync all vacancy states across the database.
 * Reads Unit.vacancyStatus as source of truth, updates VacancyInfo, Vacancy, TurnoverWorkflow to match.
 *
 * Run: npx tsx scripts/sync-all-vacancy-states.ts
 */

import { PrismaClient } from "@prisma/client";

// Import the service directly — avoid path alias issues in scripts
const prisma = new PrismaClient();

// Inline the sync logic to avoid tsconfig path alias issues in scripts
async function syncVacancyStateForScript(unitId: string) {
  const VACANT_STATUSES = [
    "VACANT", "PRE_TURNOVER", "TURNOVER", "READY_TO_SHOW",
    "RENT_PROPOSED", "RENT_APPROVED", "LISTED", "LEASED",
  ];

  const VACANCY_STAGE_MAP: Record<string, string> = {
    VACANT: "vacant", PRE_TURNOVER: "vacant", TURNOVER: "renovation",
    READY_TO_SHOW: "listed", RENT_PROPOSED: "listed", RENT_APPROVED: "listed",
    LISTED: "listed", LEASED: "lease_signed",
  };

  return prisma.$transaction(async (tx) => {
    const unit = await tx.unit.findUniqueOrThrow({
      where: { id: unitId },
      select: {
        id: true, buildingId: true, isVacant: true, vacancyStatus: true,
        vacancyInfo: { select: { id: true } },
        vacancies: { where: { isActive: true }, select: { id: true, stage: true }, take: 1 },
        turnoverWorkflows: { where: { isActive: true }, select: { id: true, status: true }, take: 1 },
      },
    });

    const status = unit.vacancyStatus;
    const shouldBeVacant = status != null && VACANT_STATUSES.includes(status);
    const shouldBeOccupied = status === "OCCUPIED" || status === null;
    const changes: string[] = [];

    if (shouldBeVacant && !unit.isVacant) {
      await tx.unit.update({ where: { id: unitId }, data: { isVacant: true } });
      changes.push("Unit.isVacant: false → true");
    } else if (shouldBeOccupied && unit.isVacant) {
      await tx.unit.update({ where: { id: unitId }, data: { isVacant: false, vacantSince: null, readyDate: null } });
      changes.push("Unit.isVacant: true → false");
    }

    if (shouldBeVacant && !unit.vacancyInfo) {
      await tx.vacancyInfo.create({ data: { unitId } });
      changes.push("VacancyInfo: created");
    } else if (shouldBeOccupied && unit.vacancyInfo) {
      await tx.vacancyInfo.delete({ where: { unitId } });
      changes.push("VacancyInfo: deleted");
    }

    const activeVacancy = unit.vacancies[0];
    if (shouldBeVacant) {
      const expectedStage = VACANCY_STAGE_MAP[status!] ?? "vacant";
      if (activeVacancy) {
        if (activeVacancy.stage !== expectedStage) {
          await tx.vacancy.update({ where: { id: activeVacancy.id }, data: { stage: expectedStage } });
          changes.push(`Vacancy.stage: ${activeVacancy.stage} → ${expectedStage}`);
        }
      }
    } else if (shouldBeOccupied && activeVacancy) {
      await tx.vacancy.update({ where: { id: activeVacancy.id }, data: { isActive: false } });
      changes.push("Vacancy: deactivated");
    }

    const activeTurnover = unit.turnoverWorkflows[0];
    if (shouldBeOccupied && activeTurnover) {
      await tx.turnoverWorkflow.update({
        where: { id: activeTurnover.id },
        data: { isActive: false, completedAt: new Date(), status: "COMPLETE" },
      });
      changes.push("TurnoverWorkflow: completed + deactivated");
    }

    return { unitId, hadDrift: changes.length > 0, changes };
  });
}

async function main() {
  const units = await prisma.unit.findMany({
    select: { id: true, unitNumber: true, buildingId: true, isVacant: true, vacancyStatus: true },
  });

  console.log(`Processing ${units.length} units...`);

  let synced = 0;
  let drifted = 0;
  let errored = 0;

  for (const unit of units) {
    try {
      const result = await syncVacancyStateForScript(unit.id);
      synced++;
      if (result.hadDrift) {
        drifted++;
        console.log(`  DRIFT unit ${unit.id} (${unit.vacancyStatus ?? "null"}): ${result.changes.join(", ")}`);
      }
    } catch (err) {
      errored++;
      console.error(`  ERROR unit ${unit.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nDone.`);
  console.log(`  Synced: ${synced}`);
  console.log(`  Had drift: ${drifted}`);
  console.log(`  Errors: ${errored}`);
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
