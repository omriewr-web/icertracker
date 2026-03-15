import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getBuildingIdScope, EMPTY_SCOPE } from "@/lib/data-scope";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, { user }) => {
  const scope = getBuildingIdScope(user);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const buildings = await prisma.building.findMany({
    where: { ...scope },
    select: {
      id: true,
      address: true,
      lat: true,
      lng: true,
      totalUnits: true,
      units: {
        select: {
          tenant: {
            select: { balance: true },
          },
        },
      },
      legalCases: {
        where: { isActive: true },
        select: { id: true },
      },
      violations: {
        where: { isOpen: true },
        select: { id: true },
      },
    },
  });

  const result = buildings.map((b) => {
    const arBalance = b.units.reduce((sum, u) => {
      if (u.tenant) {
        const bal = Number(u.tenant.balance ?? 0);
        return bal > 0 ? sum + bal : sum;
      }
      return sum;
    }, 0);
    const legalCases = b.legalCases.length;
    const openViolations = b.violations.length;

    let risk: "CRITICAL" | "HIGH" | "MEDIUM" | "STABLE";
    if (legalCases > 0 && arBalance > 20000) risk = "CRITICAL";
    else if (legalCases > 0 || openViolations >= 3) risk = "HIGH";
    else if (arBalance > 5000 || openViolations > 0) risk = "MEDIUM";
    else risk = "STABLE";

    return {
      id: b.id,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      units: b.totalUnits ?? 0,
      arBalance,
      legalCases,
      openViolations,
      risk,
    };
  });

  return NextResponse.json(result);
}, "dash");
