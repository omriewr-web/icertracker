import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { canAccessBuilding } from "@/lib/data-scope";
import { utilityAccountUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const account = await prisma.utilityAccount.findUnique({
    where: { id },
    include: {
      meter: { select: { buildingId: true, utilityType: true, meterNumber: true, building: { select: { address: true } } } },
      tenant: { select: { id: true, name: true } },
    },
  });

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, account.meter.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(account);
}, "utilities");

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const existing = await prisma.utilityAccount.findUnique({
    where: { id },
    include: { meter: { select: { buildingId: true } } },
    // Note: assignedPartyType, assignedPartyName, tenantId, accountNumber, utilityMeterId are on the root model
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, existing.meter.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { accountNumber, assignedPartyType, assignedPartyName, tenantId, startDate, endDate, status, closedWithBalance, closeReason, notes } = await parseBody(req, utilityAccountUpdateSchema);

  const account = await prisma.utilityAccount.update({
    where: { id },
    data: {
      ...(accountNumber !== undefined && { accountNumber }),
      ...(assignedPartyType !== undefined && { assignedPartyType }),
      ...(assignedPartyName !== undefined && { assignedPartyName }),
      ...(tenantId !== undefined && { tenantId: tenantId || null }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(status !== undefined && { status }),
      ...(closedWithBalance !== undefined && { closedWithBalance }),
      ...(closeReason !== undefined && { closeReason }),
      // Record who closed the account
      ...(status === "closed" && { closedByUserId: user.id }),
      ...(notes !== undefined && { notes }),
    },
  });

  // Record close event if status changed to closed
  if (status === "closed") {
    try {
      const { recordAccountClosed } = await import("@/lib/utilities/responsibility-event.service");
      const meterFull = await prisma.utilityMeter.findUnique({
        where: { id: existing.utilityMeterId },
        select: { buildingId: true, providerName: true, building: { select: { organizationId: true } } },
      });
      if (meterFull?.building?.organizationId) {
        await recordAccountClosed({
          orgId: meterFull.building.organizationId,
          buildingId: meterFull.buildingId,
          utilityMeterId: existing.utilityMeterId,
          utilityAccountId: id,
          fromPartyType: existing.assignedPartyType,
          fromPartyName: existing.assignedPartyName || undefined,
          fromTenantId: existing.tenantId || undefined,
          accountNumber: existing.accountNumber || undefined,
          providerName: meterFull.providerName || undefined,
          workflowState: closedWithBalance ? "closed_with_balance" : "closed_clean",
          triggeredBy: "manual",
          triggeredByUserId: user.id,
          notes: closeReason || undefined,
        });
      }
    } catch (e) {
      console.error("Failed to record utility close event:", e);
    }
  }

  return NextResponse.json(account);
}, "utilities");
