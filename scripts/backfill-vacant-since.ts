/**
 * Backfill vacantSince and readyDate for vacant units.
 *
 * Step 1: Find units where isVacant=true AND vacantSince IS NULL
 *         that have a linked turnover with moveOutDate set.
 *         Set unit.vacantSince = turnover.moveOutDate.
 *
 * Step 2: For units still with vacantSince=null after Step 1,
 *         set vacantSince = random date 20-90 days ago.
 *
 * Step 3: For units with status READY_TO_SHOW and no readyDate,
 *         set readyDate = vacantSince + random 20-35 days.
 *
 * Run: npx tsx scripts/backfill-vacant-since.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function randomDaysAgo(min: number, max: number): Date {
  const days = Math.floor(Math.random() * (max - min + 1)) + min;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  console.log("=== Backfill vacantSince / readyDate ===\n");

  // Step 1: Backfill from turnover moveOutDate
  const unitsWithTurnover = await prisma.unit.findMany({
    where: {
      isVacant: true,
      vacantSince: null,
    },
    select: {
      id: true,
      unitNumber: true,
      building: { select: { address: true } },
      turnoverWorkflows: {
        where: { moveOutDate: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { moveOutDate: true },
      },
    },
  });

  let step1Count = 0;
  for (const unit of unitsWithTurnover) {
    const moveOut = unit.turnoverWorkflows[0]?.moveOutDate;
    if (moveOut) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: { vacantSince: moveOut },
      });
      step1Count++;
      console.log(`  [Step 1] ${unit.building.address} #${unit.unitNumber} → vacantSince=${moveOut.toISOString().split("T")[0]}`);
    }
  }
  console.log(`\nStep 1: ${step1Count} units backfilled from turnover moveOutDate\n`);

  // Step 2: Seed remaining null vacantSince with random dates
  const stillNull = await prisma.unit.findMany({
    where: {
      isVacant: true,
      vacantSince: null,
    },
    select: {
      id: true,
      unitNumber: true,
      building: { select: { address: true } },
    },
  });

  let step2Count = 0;
  for (const unit of stillNull) {
    const vacantSince = randomDaysAgo(20, 90);
    await prisma.unit.update({
      where: { id: unit.id },
      data: { vacantSince },
    });
    step2Count++;
    console.log(`  [Step 2] ${unit.building.address} #${unit.unitNumber} → vacantSince=${vacantSince.toISOString().split("T")[0]} (seeded)`);
  }
  console.log(`\nStep 2: ${step2Count} units seeded with random vacantSince\n`);

  // Step 3: Set readyDate for READY_TO_SHOW units
  const readyUnits = await prisma.unit.findMany({
    where: {
      vacancyStatus: "READY_TO_SHOW",
      readyDate: null,
      vacantSince: { not: null },
    },
    select: {
      id: true,
      unitNumber: true,
      vacantSince: true,
      building: { select: { address: true } },
    },
  });

  let step3Count = 0;
  for (const unit of readyUnits) {
    if (!unit.vacantSince) continue;
    const daysToAdd = Math.floor(Math.random() * 16) + 20; // 20-35 days
    const readyDate = addDays(unit.vacantSince, daysToAdd);
    // Don't set readyDate in the future
    const now = new Date();
    const finalDate = readyDate > now ? now : readyDate;
    await prisma.unit.update({
      where: { id: unit.id },
      data: { readyDate: finalDate },
    });
    step3Count++;
    console.log(`  [Step 3] ${unit.building.address} #${unit.unitNumber} → readyDate=${finalDate.toISOString().split("T")[0]}`);
  }
  console.log(`\nStep 3: ${step3Count} READY_TO_SHOW units got readyDate\n`);

  console.log("=== Summary ===");
  console.log(`  From turnover moveOutDate: ${step1Count}`);
  console.log(`  Seeded random dates:       ${step2Count}`);
  console.log(`  readyDate set:             ${step3Count}`);
  console.log(`  Total updated:             ${step1Count + step2Count + step3Count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
