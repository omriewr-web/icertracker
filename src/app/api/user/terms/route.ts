import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req: NextRequest, { user }) => {
  // Check if already accepted
  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { termsAcceptedAt: true },
  });

  if (existing?.termsAcceptedAt) {
    return NextResponse.json({
      accepted: true,
      acceptedAt: existing.termsAcceptedAt,
      message: "Terms already accepted",
    });
  }

  // Record acceptance with IP
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      termsAcceptedAt: new Date(),
      termsAcceptedIp: ip,
    },
    select: { termsAcceptedAt: true },
  });

  return NextResponse.json({
    accepted: true,
    acceptedAt: updated.termsAcceptedAt,
  });
});
