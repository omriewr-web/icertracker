import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getTenantScope, EMPTY_SCOPE } from "@/lib/data-scope";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId") || undefined;
  const format = url.searchParams.get("format") || "csv";
  const scope = getTenantScope(user, buildingId);

  if (scope === EMPTY_SCOPE) {
    return new NextResponse("No data", { status: 204 });
  }

  const where = {
    ...(scope as object),
    isDeleted: false,
  };

  const tenants = await prisma.tenant.findMany({
    where,
    include: {
      leases: { where: { isCurrent: true }, take: 1, orderBy: { createdAt: "desc" } },
      unit: { include: { building: { select: { id: true, address: true, altAddress: true, region: true, entity: true, portfolio: true } } } },
      legalCases: { where: { isActive: true }, select: { inLegal: true, stage: true }, take: 1 },
      _count: { select: { notes: true, payments: true, tasks: true } },
    },
    orderBy: { balance: "desc" },
  });

  if (format === "csv") {
    const headers = [
      "Tenant Name", "Unit", "Building", "Balance", "Monthly Rent",
      "Lease Start", "Lease End", "Status", "In Legal", "Notes Count"
    ];
    const rows = tenants.map((t) => {
      const currentLease = t.leases[0];
      const monthlyRent = currentLease?.monthlyRent ?? t.marketRent;
      const leaseStart = currentLease?.leaseStart ?? t.moveInDate;
      const leaseEnd = currentLease?.leaseEnd ?? t.leaseExpiration;
      const status = currentLease?.status ?? t.leaseStatus;

      return [
        t.name,
        t.unit?.unitNumber ?? "",
        t.unit?.building?.address ?? "",
        t.balance?.toString() ?? "0",
        monthlyRent?.toString() ?? "0",
        leaseStart ? new Date(leaseStart).toLocaleDateString() : "",
        leaseEnd ? new Date(leaseEnd).toLocaleDateString() : "",
        status ?? "",
        t.legalCases?.[0]?.inLegal ? "Yes" : "No",
        String(t._count?.notes ?? 0),
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="tenants-export.csv"',
      },
    });
  }

  return NextResponse.json(tenants);
}, "reports");
