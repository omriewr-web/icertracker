import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { buildingCreateSchema } from "@/lib/validations";
import { getBuildingIdScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { getDisplayAddress } from "@/lib/building-matching";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

interface BuildingAggRow {
  buildingId: string;
  totalMarketRent: number;
  totalBalance: number;
  legalBalance: number;
  arrearsCount: number;
  legalCount: number;
  violationCount: number;
}

export const GET = withAuth(async (req, { user }) => {
  const start = Date.now();
  const log = logger.child({ route: "/api/buildings", userId: user.id });
  log.info({ action: "start" });

  const url = new URL(req.url);
  const portfolio = url.searchParams.get("portfolio");
  const pageParam = url.searchParams.get("page");
  const limitParam = url.searchParams.get("limit");
  // When no pagination params are passed (dropdown usage), return all buildings
  const paginated = pageParam != null || limitParam != null;
  const page = Math.max(1, parseInt(pageParam || "1", 10));
  const limit = Math.min(500, Math.max(1, parseInt(limitParam || "500", 10)));

  const scope = getBuildingIdScope(user);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const where: any = { ...scope };
  if (portfolio) where.portfolio = portfolio;

  // Fetch buildings with _count aggregations instead of nested includes
  const buildings = await prisma.building.findMany({
    where,
    select: {
      id: true,
      yardiId: true,
      address: true,
      altAddress: true,
      buildingName: true,
      entity: true,
      portfolio: true,
      region: true,
      zip: true,
      block: true,
      lot: true,
      type: true,
      owner: true,
      ownerEmail: true,
      manager: true,
      arTeam: true,
      apTeam: true,
      headPortfolio: true,
      mgmtStartDate: true,
      einNumber: true,
      bin: true,
      mdrNumber: true,
      dhcrRegId: true,
      squareFootage: true,
      yearBuilt: true,
      constructionType: true,
      floors: true,
      floorsBelowGround: true,
      lifeSafety: true,
      elevatorInfo: true,
      boilerInfo: true,
      complianceDates: true,
      superintendent: true,
      elevatorCompany: true,
      fireAlarmCompany: true,
      utilityMeters: true,
      utilityAccounts: true,
      _count: {
        select: {
          units: { where: { isResidential: true } },
        },
      },
    },
    orderBy: { address: "asc" },
    ...(paginated ? { skip: (page - 1) * limit, take: limit } : {}),
  });

  if (buildings.length === 0) return NextResponse.json([]);

  const buildingIds = buildings.map((b) => b.id);

  // Parallel queries: vacant count + financial aggregations
  const [vacantCounts, financialAggs] = await Promise.all([
    // Vacant unit counts per building via groupBy
    prisma.unit.groupBy({
      by: ["buildingId"],
      where: { buildingId: { in: buildingIds }, isResidential: true, isVacant: true },
      _count: true,
    }),

    // Financial aggregations via raw query — avoids fetching all tenant rows
    prisma.$queryRaw<BuildingAggRow[]>`
      SELECT
        u."buildingId" AS "buildingId",
        COALESCE(SUM(t."marketRent"), 0)::float AS "totalMarketRent",
        COALESCE(SUM(t."balance"), 0)::float AS "totalBalance",
        COALESCE(SUM(
          CASE WHEN EXISTS (
            SELECT 1 FROM legal_cases lc
            WHERE lc."tenantId" = t.id AND lc."isActive" = true AND lc."inLegal" = true
          ) THEN t."balance" ELSE 0 END
        ), 0)::float AS "legalBalance",
        COUNT(CASE WHEN t."balance" > 0 THEN 1 END)::int AS "arrearsCount",
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM legal_cases lc
          WHERE lc."tenantId" = t.id AND lc."isActive" = true AND lc."inLegal" = true
        ) THEN 1 END)::int AS "legalCount",
        (SELECT COUNT(*)::int FROM violations v WHERE v."buildingId" = u."buildingId" AND v."isOpen" = true) AS "violationCount"
      FROM units u
      LEFT JOIN tenants t ON t."unitId" = u.id
      WHERE u."buildingId" IN (${Prisma.join(buildingIds)})
        AND u."isResidential" = true
      GROUP BY u."buildingId"
    `,
  ]);

  // Build lookup maps
  const vacantMap = new Map<string, number>();
  for (const v of vacantCounts) {
    vacantMap.set(v.buildingId, v._count);
  }

  const aggMap = new Map<string, BuildingAggRow>();
  for (const a of financialAggs) {
    aggMap.set(a.buildingId, a);
  }

  const result = buildings.map((b) => {
    const totalUnits = b._count.units;
    const vacant = vacantMap.get(b.id) ?? 0;
    const occupied = totalUnits - vacant;
    const agg = aggMap.get(b.id);
    const totalMarketRent = agg?.totalMarketRent ?? 0;
    const totalBalance = agg?.totalBalance ?? 0;
    const legalBalance = agg?.legalBalance ?? 0;

    return {
      id: b.id,
      yardiId: b.yardiId,
      address: getDisplayAddress(b),
      altAddress: b.altAddress,
      entity: b.entity,
      portfolio: b.portfolio,
      region: b.region,
      zip: b.zip,
      block: b.block,
      lot: b.lot,
      type: b.type,
      owner: b.owner,
      ownerEmail: b.ownerEmail,
      manager: b.manager,
      arTeam: b.arTeam,
      apTeam: b.apTeam,
      headPortfolio: b.headPortfolio,
      mgmtStartDate: b.mgmtStartDate,
      einNumber: b.einNumber,
      bin: b.bin,
      mdrNumber: b.mdrNumber,
      dhcrRegId: b.dhcrRegId,
      squareFootage: b.squareFootage,
      yearBuilt: b.yearBuilt,
      constructionType: b.constructionType,
      floors: b.floors,
      floorsBelowGround: b.floorsBelowGround,
      lifeSafety: b.lifeSafety,
      elevatorInfo: b.elevatorInfo,
      boilerInfo: b.boilerInfo,
      complianceDates: b.complianceDates,
      superintendent: b.superintendent,
      elevatorCompany: b.elevatorCompany,
      fireAlarmCompany: b.fireAlarmCompany,
      utilityMeters: b.utilityMeters,
      utilityAccounts: b.utilityAccounts,
      totalUnits,
      occupied,
      vacant,
      totalMarketRent,
      totalBalance,
      legalBalance,
      nonLegalBalance: totalBalance - legalBalance,
      arrearsCount: agg?.arrearsCount ?? 0,
      legalCount: agg?.legalCount ?? 0,
      legalCaseCount: agg?.legalCount ?? 0,
      violationCount: agg?.violationCount ?? 0,
    };
  });

  log.info({ action: "complete", count: result.length, durationMs: Date.now() - start });
  return NextResponse.json(result);
});

// Convert null JSON fields to Prisma.DbNull for proper storage
function sanitizeJsonFields(data: any) {
  const jsonFields = ["superintendent", "elevatorCompany", "fireAlarmCompany", "utilityMeters", "utilityAccounts", "lifeSafety", "elevatorInfo", "boilerInfo", "complianceDates"];
  const result = { ...data };
  for (const field of jsonFields) {
    if (result[field] === null) {
      result[field] = Prisma.DbNull;
    }
  }
  if (result.mgmtStartDate) {
    result.mgmtStartDate = new Date(result.mgmtStartDate);
  }
  return result;
}

export const POST = withAuth(async (req, { user }) => {
  const data = await parseBody(req, buildingCreateSchema);
  const sanitized = sanitizeJsonFields(data);
  sanitized.organizationId = user.organizationId;
  const building = await prisma.building.create({ data: sanitized });
  return NextResponse.json(building, { status: 201 });
}, "upload");
