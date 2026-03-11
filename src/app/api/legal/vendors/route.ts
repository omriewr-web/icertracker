// Permission: "legal" — legal vendor lookup (attorney, marshal)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
export const GET = withAuth(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "attorney";

  const vendors = await prisma.vendor.findMany({
    where: { contactType: type },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      phone: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ vendors });
}, "legal");
