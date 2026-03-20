// Permission: "legal" — court dates dashboard
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getTenantScope, EMPTY_SCOPE } from "@/lib/data-scope";

export const dynamic = "force-dynamic";

// GET — all active legal cases with court dates, scoped to user's buildings
export const GET = withAuth(async (req, { user }) => {
  const tenantScope = getTenantScope(user);
  if (tenantScope === EMPTY_SCOPE) {
    return NextResponse.json({ cases: [] });
  }

  const cases = await prisma.legalCase.findMany({
    where: {
      isActive: true,
      inLegal: true,
      courtDate: { not: null },
      tenant: tenantScope as object,
    },
    orderBy: { courtDate: "asc" },
    take: 200,
    select: {
      id: true,
      courtDate: true,
      stage: true,
      caseNumber: true,
      attorney: true,
      tenant: {
        select: {
          id: true,
          name: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { id: true, address: true } },
            },
          },
        },
      },
      assignedUser: { select: { id: true, name: true } },
      attorneyContact: { select: { name: true, company: true } },
    },
  });

  const result = cases.map((c) => ({
    id: c.id,
    courtDate: c.courtDate,
    stage: c.stage,
    caseNumber: c.caseNumber,
    tenantId: c.tenant.id,
    tenantName: c.tenant.name,
    unitNumber: c.tenant.unit.unitNumber,
    buildingId: c.tenant.unit.building.id,
    buildingAddress: c.tenant.unit.building.address,
    assignedUserName: c.assignedUser?.name || null,
    attorneyName: c.attorneyContact
      ? `${c.attorneyContact.name}${c.attorneyContact.company ? ` — ${c.attorneyContact.company}` : ""}`
      : c.attorney || null,
  }));

  return NextResponse.json({ cases: result });
}, "legal");
