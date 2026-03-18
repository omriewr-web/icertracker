import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getOrgScope } from "@/lib/data-scope";
import { recalculateBatch } from "@/lib/services/collections.service";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (_req, { user }) => {
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" && user.role !== "ACCOUNT_ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const orgScope = getOrgScope(user);
  const tenants = await prisma.tenant.findMany({
    where: {
      isDeleted: false,
      unit: { building: orgScope },
    },
    select: { id: true },
  });

  const tenantIds = tenants.map((t) => t.id);
  const result = await recalculateBatch(tenantIds);

  return NextResponse.json(result);
}, "collections");
