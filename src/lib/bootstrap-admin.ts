import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export async function bootstrapAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !username || !password) return;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      name: "Admin",
      username,
      passwordHash: hash,
      role: "ADMIN",
      active: true,
    },
  });
}
