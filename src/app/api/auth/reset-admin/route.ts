import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { secret } = await req.json();
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const hash = await bcrypt.hash("Atlas2026!", 12);
  const user = await prisma.user.update({
    where: { email: "omriewr@gmail.com" },
    data: { passwordHash: hash },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json({ ok: true, user });
}
