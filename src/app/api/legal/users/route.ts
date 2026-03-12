export const dynamic = 'force-dynamic';

// Permission: "legal" — users with access to a building for legal case assignment
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getOrgScope } from "@/lib/data-scope";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN"];


export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const orgScope = getOrgScope(user);


  const where: any = { active: true, ...orgScope };


  if (buildingId) {
    // Users assigned to this specific building, or admins (who see all)
    where.OR = [
      { assignedProperties: { some: { buildingId } } },
      { role: { in: ADMIN_ROLES } },
    ];
  }


  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });


  return NextResponse.json({ users });
}, "legal");
