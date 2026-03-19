import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshStageStatuses } from "@/lib/collections/collectionsBackfill";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run for all active organizations
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
}
