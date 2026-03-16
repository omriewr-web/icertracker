import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getBuildingScope, EMPTY_SCOPE } from "@/lib/data-scope";
import type { ViolationStats } from "@/types";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const start = Date.now();
  const log = logger.child({ route: "/api/violations/stats", userId: user.id });
  log.info({ action: "start" });

  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const orgFilter = isAdmin
    ? {}
    : user.organizationId
      ? { organizationId: user.organizationId }
      : null;

  if (orgFilter === null) {
    return NextResponse.json({ totalOpen: 0, classACount: 0, classBCount: 0, classCCount: 0, totalPenalties: 0, upcomingHearings: 0 });
  }

  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");

  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) {
    return NextResponse.json({ totalOpen: 0, classACount: 0, classBCount: 0, classCCount: 0, totalPenalties: 0, upcomingHearings: 0 });
  }

  const where: any = { ...scope };
  // Exclude dismissed/closed
  where.currentStatus = { notIn: ["CLOSE", "CLOSED", "DISMISSED"] };

  const [total, classA, classB, classC, penalties, hearings] = await Promise.all([
    prisma.violation.count({ where }),
    prisma.violation.count({ where: { ...where, class: "A" } }),
    prisma.violation.count({ where: { ...where, class: "B" } }),
    prisma.violation.count({ where: { ...where, class: "C" } }),
    prisma.violation.aggregate({ where, _sum: { penaltyAmount: true } }),
    prisma.violation.count({
      where: {
        ...where,
        hearingDate: { gte: new Date() },
      },
    }),
  ]);

  const stats: ViolationStats = {
    totalOpen: total,
    classACount: classA,
    classBCount: classB,
    classCCount: classC,
    totalPenalties: Number(penalties._sum.penaltyAmount || 0),
    upcomingHearings: hearings,
  };

  log.info({ action: "complete", totalOpen: stats.totalOpen, durationMs: Date.now() - start });
  return NextResponse.json(stats);
}, "compliance");
