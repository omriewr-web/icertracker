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

  const settled = await Promise.allSettled(
    orgs.map((org) => refreshStageStatuses(org.id).then((r) => ({ orgId: org.id, ...r })))
  );

  const results = settled.map((s) =>
    s.status === "fulfilled"
      ? s.value
      : { orgId: "unknown", error: s.reason instanceof Error ? s.reason.message : "Unknown error" }
  );

  return NextResponse.json({ success: true, results });
});
