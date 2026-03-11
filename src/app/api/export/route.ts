import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { exportToExcel } from "@/lib/excel-export";
import { getTenantScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { getDisplayAddress } from "@/lib/building-matching";
import { TenantView } from "@/types";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const scope = getTenantScope(user, buildingId);
  if (scope === EMPTY_SCOPE) {
    return new NextResponse("No data", { status: 204 });
  }
  const where = { ...scope };

  const tenants = await prisma.tenant.findMany({
    where,
    include: {
      unit: { include: { building: { select: { id: true, address: true, altAddress: true, region: true, entity: true, portfolio: true } } } },
      legalCases: { where: { isActive: true }, select: { inLegal: true, stage: true }, take: 1 },
      _count: { select: { notes: true, payments: true, tasks: true } },
    },
    orderBy: { balance: "desc" },
  });

  const views: TenantView[] = tenants.map((t) => ({
    id: t.id,
    unitId: t.unitId,
    yardiResidentId: t.yardiResidentId,
    name: t.name,
    email: t.email,
    phone: t.phone,
    unitNumber: t.unit.unitNumber,
    unitType: t.unit.unitType,
    buildingId: t.unit.building.id,
    buildingAddress: getDisplayAddress(t.unit.building),
    buildingRegion: t.unit.building.region,
    entity: t.unit.building.entity,
    portfolio: t.unit.building.portfolio,
    marketRent: Number(t.marketRent),
    legalRent: Number(t.legalRent),
    dhcrLegalRent: Number(t.dhcrLegalRent),
    prefRent: Number(t.prefRent),
    actualRent: Number(t.actualRent),
    chargeCode: t.chargeCode,
    isStabilized: t.isStabilized,
    deposit: Number(t.deposit),
    moveInDate: t.moveInDate?.toISOString() ?? null,
    leaseExpiration: t.leaseExpiration?.toISOString() ?? null,
    moveOutDate: t.moveOutDate?.toISOString() ?? null,
    balance: Number(t.balance),
    arrearsCategory: t.arrearsCategory as any,
    arrearsDays: t.arrearsDays,
    monthsOwed: Number(t.monthsOwed),
    leaseStatus: t.leaseStatus as any,
    collectionScore: t.collectionScore,
    legalFlag: t.legalCases?.[0]?.inLegal ?? false,
    legalStage: t.legalCases?.[0]?.stage?.toLowerCase().replace(/_/g, "-") as any ?? null,
    legalRecommended: t.collectionScore >= 60 && !t.legalCases?.[0]?.inLegal,
    noteCount: t._count.notes,
    paymentCount: t._count.payments,
    taskCount: t._count.tasks,
  }));

  const buffer = exportToExcel(views, "AtlasPM-Export");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="atlaspm-export-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}, "reports");
