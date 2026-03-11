import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getTenantScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { getDisplayAddress } from "@/lib/building-matching";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");

  const scope = getTenantScope(user, buildingId);
  if (scope === EMPTY_SCOPE) {
    return NextResponse.json({ urgentTenants: [], recentNotes: [], recentPayments: [], legalCases: [], expiringLeases: [] });
  }

  const [urgentTenants, recentNotes, recentPayments, legalCases] = await Promise.all([
    prisma.tenant.findMany({
      where: { ...scope, collectionScore: { gte: 60 } },
      include: { unit: { include: { building: { select: { address: true, altAddress: true } } } }, legalCases: { where: { isActive: true }, select: { stage: true }, take: 1 } },
      orderBy: { collectionScore: "desc" },
      take: 20,
    }),
    prisma.tenantNote.findMany({
      where: { tenant: scope },
      include: { tenant: { select: { name: true } }, author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.payment.findMany({
      where: { tenant: scope },
      include: { tenant: { select: { name: true } }, recorder: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.legalCase.findMany({
      where: { isActive: true, inLegal: true, tenant: scope },
      include: { tenant: { select: { name: true, balance: true }, include: { unit: { select: { unitNumber: true, building: { select: { address: true, altAddress: true } } } } } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  const expiringLeases = await prisma.tenant.findMany({
    where: { ...scope, leaseStatus: "expiring-soon" },
    include: { unit: { include: { building: { select: { address: true, altAddress: true } } } } },
    orderBy: { leaseExpiration: "asc" },
    take: 10,
  });

  return NextResponse.json({
    urgentTenants: urgentTenants.map((t) => ({
      id: t.id,
      name: t.name,
      balance: Number(t.balance),
      collectionScore: t.collectionScore,
      building: getDisplayAddress(t.unit.building),
      unit: t.unit.unitNumber,
      legalStage: t.legalCases?.[0]?.stage,
    })),
    recentNotes,
    recentPayments,
    legalCases,
    expiringLeases: expiringLeases.map((t) => ({
      id: t.id,
      name: t.name,
      leaseExpiration: t.leaseExpiration,
      building: getDisplayAddress(t.unit.building),
      unit: t.unit.unitNumber,
    })),
  });
});
