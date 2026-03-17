import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getTenantScope, getBuildingScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { getDisplayAddress } from "@/lib/building-matching";
import { toNumber } from "@/lib/utils/decimal";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");

  const scope = getTenantScope(user, buildingId);
  if (scope === EMPTY_SCOPE) {
    return NextResponse.json({
      urgentTenants: [], recentNotes: [], recentPayments: [], legalCases: [], expiringLeases: [],
      collectionsAlerts: { highPriority: 0, stale: 0, top3: [] },
      todaysFollowups: [],
      violationsSummary: { classCNoWO: 0 },
    });
  }

  const buildingScope = getBuildingScope(user, buildingId);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    urgentTenants,
    recentNotes,
    recentPayments,
    legalCases,
    highPriorityCount,
    staleCount,
    top3Tenants,
    todaysFollowups,
    classCNoWO,
  ] = await Promise.all([
    prisma.tenant.findMany({
      where: { ...scope, isDeleted: false, collectionScore: { gte: 60 } },
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
    // highPriority: balance > 5000 and no active legal case
    prisma.tenant.count({
      where: {
        ...scope,
        isDeleted: false,
        balance: { gt: 5000 },
        legalCases: { none: { isActive: true } },
      },
    }),
    // stale: balance > 0, no collection note in 30 days
    prisma.tenant.count({
      where: {
        ...scope,
        isDeleted: false,
        balance: { gt: 0 },
        collectionNotes: { none: { createdAt: { gte: thirtyDaysAgo } } },
      },
    }),
    // top3 by balance
    prisma.tenant.findMany({
      where: { ...scope, isDeleted: false, balance: { gt: 0 } },
      include: { unit: { include: { building: { select: { address: true, altAddress: true } } } } },
      orderBy: { balance: "desc" },
      take: 3,
    }),
    // today's follow-ups
    prisma.collectionNote.findMany({
      where: {
        tenant: scope,
        followUpDate: { gte: todayStart, lte: todayEnd },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            unit: { select: { unitNumber: true, building: { select: { address: true, altAddress: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Class C violations without linked work order
    prisma.violation.count({
      where: {
        ...(buildingScope === EMPTY_SCOPE ? {} : buildingScope),
        class: "C",
        linkedWorkOrderId: null,
      },
    }),
  ]);

  const expiringLeases = await prisma.tenant.findMany({
    where: { ...scope, isDeleted: false, leaseStatus: "expiring-soon" },
    include: { unit: { include: { building: { select: { address: true, altAddress: true } } } } },
    orderBy: { leaseExpiration: "asc" },
    take: 10,
  });

  return NextResponse.json({
    urgentTenants: urgentTenants.map((t) => ({
      id: t.id,
      name: t.name,
      balance: toNumber(t.balance),
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
    collectionsAlerts: {
      highPriority: highPriorityCount,
      stale: staleCount,
      top3: top3Tenants.map((t) => ({
        id: t.id,
        name: t.name,
        balance: toNumber(t.balance),
        building: getDisplayAddress(t.unit.building),
        unit: t.unit.unitNumber,
      })),
    },
    todaysFollowups: todaysFollowups.map((n) => ({
      id: n.id,
      tenantId: n.tenant.id,
      tenantName: n.tenant.name,
      unit: n.tenant.unit?.unitNumber ?? "",
      building: n.tenant.unit?.building ? getDisplayAddress(n.tenant.unit.building) : "",
      content: n.content,
      actionType: n.actionType,
      followUpDate: n.followUpDate,
    })),
    violationsSummary: {
      classCNoWO,
    },
  });
}, "dash");
