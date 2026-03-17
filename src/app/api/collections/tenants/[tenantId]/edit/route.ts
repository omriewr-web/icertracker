import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { assertTenantAccess } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const tenantEditSchema = z.object({
  legalRent: z.number().min(0).optional(),
  prefRent: z.number().min(0).optional(),
  isStabilized: z.boolean().optional(),
  regulationType: z.enum(["STABILIZED", "CONTROLLED", "UNREGULATED", "UNKNOWN"]).optional(),
  dhcrRegistrationId: z.string().nullable().optional(),
});

export const PATCH = withAuth(async (req: NextRequest, { user, params }) => {
  const { tenantId } = await params;
  const denied = await assertTenantAccess(user, tenantId);
  if (denied) return denied;

  const body = await parseBody(req, tenantEditSchema);

  // Separate tenant fields from unit fields
  const tenantData: Record<string, unknown> = {};
  const unitData: Record<string, unknown> = {};

  if (body.legalRent !== undefined) tenantData.legalRent = body.legalRent;
  if (body.prefRent !== undefined) tenantData.prefRent = body.prefRent;
  if (body.isStabilized !== undefined) tenantData.isStabilized = body.isStabilized;

  if (body.regulationType !== undefined) unitData.regulationType = body.regulationType;
  if (body.dhcrRegistrationId !== undefined) unitData.dhcrRegistrationId = body.dhcrRegistrationId;

  // Look up the tenant to get unitId
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { unitId: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Update tenant fields
  const updatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: tenantData,
    include: {
      unit: {
        select: {
          id: true,
          unitNumber: true,
          regulationType: true,
          dhcrRegistrationId: true,
          building: { select: { id: true, address: true } },
        },
      },
    },
  });

  // Update unit fields if any
  if (Object.keys(unitData).length > 0) {
    await prisma.unit.update({
      where: { id: tenant.unitId },
      data: unitData,
    });
  }

  // Normalize Decimal fields to numbers
  const result = {
    ...updatedTenant,
    legalRent: Number(updatedTenant.legalRent),
    prefRent: Number(updatedTenant.prefRent),
    marketRent: Number(updatedTenant.marketRent),
    actualRent: Number(updatedTenant.actualRent),
    balance: Number(updatedTenant.balance),
    deposit: Number(updatedTenant.deposit),
    dhcrLegalRent: Number(updatedTenant.dhcrLegalRent),
    monthsOwed: Number(updatedTenant.monthsOwed),
    iaiMonthlyIncrease: updatedTenant.iaiMonthlyIncrease != null ? Number(updatedTenant.iaiMonthlyIncrease) : null,
    unit: {
      ...updatedTenant.unit,
      regulationType: body.regulationType ?? updatedTenant.unit.regulationType,
      dhcrRegistrationId: body.dhcrRegistrationId !== undefined ? body.dhcrRegistrationId : updatedTenant.unit.dhcrRegistrationId,
    },
  };

  return NextResponse.json(result);
}, "collections");
