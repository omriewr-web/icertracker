// Permission: "legal" — legal referral candidates
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getTenantScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { scoreLegalCandidate } from "@/lib/legal-matching";

// GET — Return tenants who are candidates for legal referral
export const GET = withAuth(async (req, { user }) => {
  const scope = getTenantScope(user);
  if (scope === EMPTY_SCOPE) {
    return NextResponse.json({ candidates: [], total: 0 });
  }

  const tenants = await prisma.tenant.findMany({
    where: {
      ...(scope as object),
      balance: { gt: 0 },
      legalCases: { none: { isActive: true } },
    },
    select: {
      id: true,
      name: true,
      balance: true,
      marketRent: true,
      collectionScore: true,
      arrearsCategory: true,
      leaseStatus: true,
      arrearsDays: true,
      monthsOwed: true,
      unit: {
        select: {
          unitNumber: true,
          building: { select: { address: true } },
        },
      },
    },
    orderBy: { collectionScore: "desc" },
  });

  const candidates = tenants
    .map((t) => {
      const { score, reasons } = scoreLegalCandidate({
        balance: Number(t.balance),
        marketRent: Number(t.marketRent),
        collectionScore: t.collectionScore,
        arrearsCategory: t.arrearsCategory,
        leaseStatus: t.leaseStatus,
        arrearsDays: t.arrearsDays,
      });

      return {
        tenantId: t.id,
        name: t.name,
        unitNumber: t.unit.unitNumber,
        buildingAddress: t.unit.building.address,
        balance: Number(t.balance),
        monthsOwed: Number(t.monthsOwed),
        collectionScore: t.collectionScore,
        arrearsCategory: t.arrearsCategory,
        leaseStatus: t.leaseStatus,
        arrearsDays: t.arrearsDays,
        referralScore: score,
        reasons,
      };
    })
    .filter((c) => c.referralScore >= 40)
    .sort((a, b) => b.referralScore - a.referralScore);

  return NextResponse.json({ candidates, total: candidates.length });
}, "legal");
