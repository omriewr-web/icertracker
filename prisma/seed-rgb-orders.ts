/**
 * Seed RGB (Rent Guidelines Board) orders into the database.
 * Safe to run multiple times — uses upsert on orderNumber.
 *
 * Usage: npx tsx prisma/seed-rgb-orders.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

const RGB_ORDERS = [
  { orderNumber: "46", effectiveFrom: "2014-10-01", effectiveTo: "2015-09-30", oneYearPct: 0.0100, twoYearPct: 0.0275, twoYearY1Pct: null, twoYearY2Pct: null, notes: null },
  { orderNumber: "47", effectiveFrom: "2015-10-01", effectiveTo: "2016-09-30", oneYearPct: 0.0000, twoYearPct: 0.0200, twoYearY1Pct: null, twoYearY2Pct: null, notes: null },
  { orderNumber: "48", effectiveFrom: "2016-10-01", effectiveTo: "2017-09-30", oneYearPct: 0.0000, twoYearPct: 0.0200, twoYearY1Pct: null, twoYearY2Pct: null, notes: null },
  { orderNumber: "49", effectiveFrom: "2017-10-01", effectiveTo: "2018-09-30", oneYearPct: 0.0125, twoYearPct: 0.0200, twoYearY1Pct: null, twoYearY2Pct: null, notes: null },
  { orderNumber: "50", effectiveFrom: "2018-10-01", effectiveTo: "2019-09-30", oneYearPct: 0.0150, twoYearPct: 0.0250, twoYearY1Pct: null, twoYearY2Pct: null, notes: null },
  { orderNumber: "51", effectiveFrom: "2019-10-01", effectiveTo: "2020-09-30", oneYearPct: 0.0150, twoYearPct: 0.0250, twoYearY1Pct: null, twoYearY2Pct: null, notes: null },
  { orderNumber: "52", effectiveFrom: "2020-10-01", effectiveTo: "2021-09-30", oneYearPct: 0.0000, twoYearPct: 0.0000, twoYearY1Pct: null, twoYearY2Pct: null, notes: "COVID freeze" },
  { orderNumber: "53", effectiveFrom: "2021-10-01", effectiveTo: "2022-09-30", oneYearPct: 0.0150, twoYearPct: 0.0250, twoYearY1Pct: null, twoYearY2Pct: null, notes: null },
  { orderNumber: "54", effectiveFrom: "2022-10-01", effectiveTo: "2023-09-30", oneYearPct: 0.0325, twoYearPct: 0.0500, twoYearY1Pct: null, twoYearY2Pct: null, notes: null },
  { orderNumber: "55", effectiveFrom: "2023-10-01", effectiveTo: "2024-09-30", oneYearPct: 0.0300, twoYearPct: 0.0575, twoYearY1Pct: 0.0275, twoYearY2Pct: 0.0320, notes: "Split 2-year: 2.75% Y1, 3.20% Y2" },
  { orderNumber: "56", effectiveFrom: "2024-10-01", effectiveTo: "2025-09-30", oneYearPct: 0.0275, twoYearPct: 0.0525, twoYearY1Pct: null, twoYearY2Pct: null, notes: null },
  { orderNumber: "57", effectiveFrom: "2025-10-01", effectiveTo: "2026-09-30", oneYearPct: 0.0300, twoYearPct: 0.0450, twoYearY1Pct: null, twoYearY2Pct: null, notes: null },
] as const;

async function main() {
  console.log("Seeding RGB orders...");

  for (const order of RGB_ORDERS) {
    await prisma.rgbOrder.upsert({
      where: { orderNumber: order.orderNumber },
      create: {
        orderNumber: order.orderNumber,
        effectiveFrom: new Date(order.effectiveFrom),
        effectiveTo: new Date(order.effectiveTo),
        oneYearPct: order.oneYearPct,
        twoYearPct: order.twoYearPct,
        twoYearY1Pct: order.twoYearY1Pct,
        twoYearY2Pct: order.twoYearY2Pct,
        notes: order.notes,
      },
      update: {
        effectiveFrom: new Date(order.effectiveFrom),
        effectiveTo: new Date(order.effectiveTo),
        oneYearPct: order.oneYearPct,
        twoYearPct: order.twoYearPct,
        twoYearY1Pct: order.twoYearY1Pct,
        twoYearY2Pct: order.twoYearY2Pct,
        notes: order.notes,
      },
    });
    console.log(`  RGB Order #${order.orderNumber}: upserted`);
  }

  console.log(`Done — ${RGB_ORDERS.length} RGB orders seeded.`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
