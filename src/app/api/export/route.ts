import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantScope, EMPTY_SCOPE } from "@/lib/services/scopeService";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const buildingId = searchParams.get("buildingId") || undefined;
  const format = searchParams.get("format") || "csv";

  const user = session.user as any;
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

  const rows = tenants.map((t) => ({
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
    altAddress: t.unit.building.altAddress ?? "",
    region: t.unit.building.region ?? "",
    entity: t.unit.building.entity ?? "",
    portfolio: t.unit.building.portfolio ?? "",
    balance: Number(t.balance ?? 0),
    monthlyRent: Number(t.monthlyRent ?? 0),
    legalRent: Number(t.legalRent ?? 0),
    leaseStart: t.leaseStart?.toISOString().split("T")[0] ?? "",
    leaseEnd: t.leaseEnd?.toISOString().split("T")[0] ?? "",
    moveInDate: t.moveInDate?.toISOString().split("T")[0] ?? "",
    status: t.status,
    collectionStatus: t.collectionStatus ?? "",
    inLegal: t.legalCases?.[0]?.inLegal ?? false,
    legalStage: t.legalCases?.[0]?.stage ?? "",
    notesCount: t._count.notes,
    paymentsCount: t._count.payments,
    tasksCount: t._count.tasks,
  }));

  if (format === "json") {
    return NextResponse.json(rows);
  }

  // CSV export
  if (rows.length === 0) {
    return new NextResponse("No data", { status: 204 });
  }

  const headers = Object.keys(rows[0]) as (keyof typeof rows[0])[];
  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const val = r[h];
        const str = val === null || val === undefined ? "" : String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? '"' + str.replace(/"/g, '""') + '"'
          : str;
      }).join(",")
    ),
  ];

  const csv = csvLines.join("\n");
  const filename = "ar-export-" + new Date().toISOString().split("T")[0] + ".csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
