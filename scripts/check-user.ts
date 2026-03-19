import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const prisma = new PrismaClient();

  // Find by email
  const user = await prisma.user.findUnique({
    where: { email: "omriewr@gmail.com" },
    select: { id: true, email: true, username: true, role: true, active: true, passwordHash: true },
  });

  if (user) {
    const match = await bcrypt.compare("IcerTracker2026!", user.passwordHash);
    console.log("Found user:", { ...user, passwordHash: user.passwordHash.substring(0, 10) + "..." });
    console.log("Password matches:", match);
  } else {
    console.log("User NOT found with email omriewr@gmail.com");
    const allUsers = await prisma.user.findMany({
      select: { email: true, username: true, role: true, active: true },
    });
    console.log("All users:", allUsers);
  }

  await prisma.$disconnect();
}

main();
