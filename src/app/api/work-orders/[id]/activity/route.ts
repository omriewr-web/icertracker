import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { assertWorkOrderAccess } from "@/lib/data-scope";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertWorkOrderAccess(user, id);
  if (denied) return denied;

  const activities = await prisma.workOrderActivity.findMany({
    where: { workOrderId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(activities);
}, "maintenance");
