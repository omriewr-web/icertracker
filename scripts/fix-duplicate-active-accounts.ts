import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Find all meters with more than one active account
  const meters = await prisma.utilityAccount.groupBy({
    by: ["utilityMeterId"],
    where: { status: "active" },
    having: { utilityMeterId: { _count: { gt: 1 } } },
    _count: { utilityMeterId: true },
  });

  console.log(`Found ${meters.length} meters with multiple active accounts`);

  for (const { utilityMeterId } of meters) {
    const accounts = await prisma.utilityAccount.findMany({
      where: { utilityMeterId, status: "active" },
      orderBy: { createdAt: "desc" },
    });

    const [keep, ...close] = accounts;
    console.log(
      `Meter ${utilityMeterId}: keeping account ${keep.id}, closing ${close.map((a) => a.id).join(", ")}`
    );

    await prisma.utilityAccount.updateMany({
      where: { id: { in: close.map((a) => a.id) } },
      data: {
        status: "closed",
        endDate: new Date(),
        closeReason: "auto_closed_duplicate_cleanup",
      },
    });
  }

  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
