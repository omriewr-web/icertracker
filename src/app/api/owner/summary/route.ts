import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getOrgScope } from "@/lib/data-scope";
import { getDisplayAddress } from "@/lib/building-matching";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const orgScope = getOrgScope(user);

  // Portfolio stats — buildings and units
  const buildings = await prisma.building.findMany({
    where: orgScope,
    select: {
      id: true,
      address: true,
      altAddress: true,
      totalUnits: true,
      units: {
        select: {
          id: true,
          isVacant: true,
          tenant: {
            select: {
              id: true,
              balance: true,
              isDeleted: true,
              legalCases: {
                where: { isActive: true },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  const totalUnits = buildings.reduce((sum, b) => sum + (b.totalUnits || b.units.length), 0);
  const vacantUnits = buildings.reduce((sum, b) => sum + b.units.filter((u) => u.isVacant).length, 0);
  const occupied = totalUnits - vacantUnits;
  const occupancyRate = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0;

  // Collections stats — derived from units' tenants
  const allTenants = buildings.flatMap((b) =>
    b.units.filter((u) => u.tenant && !u.tenant.isDeleted).map((u) => u.tenant!)
  );

  const totalAR = allTenants.reduce((sum, t) => sum + Number(t.balance || 0), 0);
  const tenantsWithBalance = allTenants.filter((t) => Number(t.balance || 0) > 0).length;
  const tenantsCurrent = allTenants.length - tenantsWithBalance;
  const tenantsInLegal = allTenants.filter((t) => t.legalCases.length > 0).length;

  // Top 5 buildings by AR balance
  const buildingARMap = new Map<string, { address: string; totalAR: number }>();
  for (const b of buildings) {
    const ar = b.units.reduce((sum, u) => {
      if (u.tenant && !u.tenant.isDeleted) {
        return sum + Number(u.tenant.balance || 0);
      }
      return sum;
    }, 0);
    if (ar > 0) {
      buildingARMap.set(b.id, { address: getDisplayAddress(b), totalAR: ar });
    }
  }
  const topBuildings = Array.from(buildingARMap.entries())
    .sort((a, b) => b[1].totalAR - a[1].totalAR)
    .slice(0, 5)
    .map(([buildingId, data]) => ({ buildingId, ...data }));

  // Violations by class
  const violationCounts = await prisma.violation.groupBy({
    by: ["class"],
    where: {
      building: orgScope,
      isOpen: true,
    },
    _count: true,
  });

  const violations = {
    classA: violationCounts.find((v) => v.class === "A")?._count || 0,
    classB: violationCounts.find((v) => v.class === "B")?._count || 0,
    classC: violationCounts.find((v) => v.class === "C")?._count || 0,
  };

  // Work orders by status
  const woCounts = await prisma.workOrder.groupBy({
    by: ["status"],
    where: {
      building: orgScope,
    },
    _count: true,
  });

  const workOrders = {
    open: woCounts.find((w) => w.status === "OPEN")?._count || 0,
    inProgress: woCounts.find((w) => w.status === "IN_PROGRESS")?._count || 0,
    completed: woCounts.find((w) => w.status === "COMPLETED")?._count || 0,
  };

  // Legal active cases
  const activeLegal = await prisma.legalCase.count({
    where: {
      building: orgScope,
      isActive: true,
    },
  });

  return NextResponse.json({
    portfolio: { totalUnits, occupied, vacant: vacantUnits, occupancyRate },
    collections: { totalAR, tenantsCurrent, tenantsWithBalance, tenantsInLegal },
    topBuildings,
    violations,
    workOrders,
    legal: { activeCases: activeLegal },
  });
}, "owner");
