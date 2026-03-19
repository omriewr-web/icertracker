import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export const PATCH = withAuth(async (req, { user }) => {
  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingComplete: true },
  });

  return NextResponse.json({ success: true });
});
