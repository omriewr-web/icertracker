import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronAuth } from "@/lib/with-cron-auth";
import { refreshStageStatuses } from "@/lib/collections/collectionsBackfill";

export const dynamic = "force-dynamic";

export const POST = withCronAuth(async () => {
  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const results = [];
  for (const org of orgs) {
    const result = await refreshStageStatuses(org.id);
    results.push({ orgId: org.id, ...result });
  }

  return NextResponse.json({ success: true, results });
});
