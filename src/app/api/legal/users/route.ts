// Permission: "legal" — users with access to a building for legal case assignment
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

export const GET = withAuth(async (req) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");

  const where: any = { active: true };

  if (buildingId) {
    // Users assigned to this specific building, or admins (who see all)
    where.OR = [
      { assignedProperties: { some: { buildingId } } },
      { role: "ADMIN" },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ users });
}, "legal");
