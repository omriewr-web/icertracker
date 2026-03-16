import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getBuildingScope, EMPTY_SCOPE } from "@/lib/data-scope";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const start = Date.now();
  const log = logger.child({ route: "/api/legal", userId: user.id });
  log.info({ action: "start" });

  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");

  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const cases = await prisma.legalCase.findMany({
    where: {
      isActive: true,
      inLegal: true,
      ...(scope as object),
    },
    select: {
      id: true,
      stage: true,
      status: true,
      buildingId: true,
      tenantId: true,
      courtDate: true,
      arrearsBalance: true,
      isActive: true,
      createdAt: true,
      tenant: {
        select: {
          name: true,
          unit: { select: { unitNumber: true, building: { select: { address: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  log.info({ action: "complete", count: cases.length, durationMs: Date.now() - start });
  return NextResponse.json(cases);
}, "legal");
