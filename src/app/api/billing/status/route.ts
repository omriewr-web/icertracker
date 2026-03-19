import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

export const GET = withAuth(async (_req, { user }) => {
  if (!user.organizationId) {
    return NextResponse.json(
      { error: "Organization not configured" },
      { status: 400 }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      pricePerUnit: true,
    },
  });

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  // Count actual units from the database rather than using a stored field
  const unitCount = await prisma.unit.count({
    where: {
      building: {
        organizationId: user.organizationId,
      },
    },
  });

  return NextResponse.json({
    unitCount,
    pricePerUnit: Number(org.pricePerUnit),
    subscriptionStatus: org.subscriptionStatus,
    currentPeriodEnd: org.currentPeriodEnd,
    stripeCustomerId: org.stripeCustomerId,
    stripeSubscriptionId: org.stripeSubscriptionId,
  });
}, "allProps");
