import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, buildWhereClause } from "@/lib/api-helpers";
import { exportToExcel } from "@/lib/excel-export";
import { TenantView } from "@/types";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const where = buildWhereClause(user, buildingId);

  const tenants = await prisma.tenant.findMany({
    where,
    include: {
      unit: { include: { building: { select: { id: true, address: true, region: true, entity: true, portfolio: true } } } },
      legalCase: { select: { inLegal: true, stage: true } },
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
    buildingAddress: t.unit.building.address,
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
    legalFlag: t.legalCase?.inLegal ?? false,
    legalStage: t.legalCase?.stage?.toLowerCase().replace(/_/g, "-") as any ?? null,
    legalRecommended: t.collectionScore >= 60 && !t.legalCase?.inLegal,
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
