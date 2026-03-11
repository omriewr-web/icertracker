// Permission: "legal" — legal portfolio stat counts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getTenantScope, EMPTY_SCOPE } from "@/lib/data-scope";

export const GET = withAuth(async (req, { user }) => {
  const tenantScope = getTenantScope(user);

  if (tenantScope === EMPTY_SCOPE) {
    return NextResponse.json({
      activeCases: 0,
      courtThisWeek: 0,
      noAttorney: 0,
      noAssignee: 0,
      pendingReview: 0,
    });
  }

  const now = new Date();
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const baseWhere = {
    isActive: true,
    inLegal: true,
    tenant: tenantScope as object,
  };

  const [activeCases, courtThisWeek, noAttorney, noAssignee, pendingReview] = await Promise.all([
    prisma.legalCase.count({ where: baseWhere }),

    prisma.legalCase.count({
      where: {
        ...baseWhere,
        courtDate: { gte: now, lte: weekFromNow },
      },
    }),

    prisma.legalCase.count({
      where: {
        ...baseWhere,
        attorneyId: null,
        attorney: null,
      },
    }),

    prisma.legalCase.count({
      where: {
        ...baseWhere,
        assignedUserId: null,
      },
    }),

    prisma.legalImportQueue.count({
      where: { status: "pending" },
    }),
  ]);

  return NextResponse.json({
    activeCases,
    courtThisWeek,
    noAttorney,
    noAssignee,
    pendingReview,
  });
}, "legal");
