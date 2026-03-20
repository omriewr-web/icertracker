import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { canAccessBuilding } from "@/lib/data-scope";
import { utilityAccountCreateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req, { user }) => {
  const { utilityMeterId, accountNumber, assignedPartyType, assignedPartyName, tenantId, startDate, notes } = await parseBody(req, utilityAccountCreateSchema);

  // Verify meter access
  const meter = await prisma.utilityMeter.findUnique({
    where: { id: utilityMeterId },
    select: { buildingId: true },
  });
  if (!meter) return NextResponse.json({ error: "Meter not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, meter.buildingId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // FIX 1c: Enforce one active account per meter — check + create in transaction
  try {
    const account = await prisma.$transaction(async (tx) => {
      const existingActive = await tx.utilityAccount.findFirst({
        where: { utilityMeterId, status: "active" },
        select: { id: true, accountNumber: true, startDate: true },
      });

      if (existingActive) {
        throw new Error(
          `CONFLICT:Meter already has an active account (id: ${existingActive.id}, ` +
          `account #: ${existingActive.accountNumber || "N/A"}, ` +
          `opened: ${existingActive.startDate?.toISOString().split("T")[0] || "unknown"}). ` +
          `Close the current account before opening a new one.`
        );
      }

      // FIX 2b: Snapshot tenant identity at account open time
      let tenantNameSnapshot: string | null = null;
      let leaseStartSnapshot: Date | null = null;
      let leaseEndSnapshot: Date | null = null;

      if (tenantId) {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true, moveInDate: true, leaseExpiration: true },
        });
        if (tenant) {
          tenantNameSnapshot = tenant.name;
          leaseStartSnapshot = tenant.moveInDate ?? null;
          leaseEndSnapshot = tenant.leaseExpiration ?? null;
        }
      }

      return tx.utilityAccount.create({
        data: {
          utilityMeterId,
          accountNumber: accountNumber || null,
          assignedPartyType,
          assignedPartyName: assignedPartyName || null,
          tenantId: tenantId || null,
          tenantNameSnapshot,
          leaseStartSnapshot,
          leaseEndSnapshot,
          startDate: startDate ? new Date(startDate) : null,
          status: "active",
          notes: notes || null,
        },
      });
    });

    // Record responsibility event (non-blocking — don't fail the request)
    try {
      const { recordAccountOpened } = await import("@/lib/utilities/responsibility-event.service");
      const meterFull = await prisma.utilityMeter.findUnique({
        where: { id: utilityMeterId },
        select: { buildingId: true, providerName: true, building: { select: { organizationId: true } } },
      });
      if (meterFull?.building?.organizationId) {
        await recordAccountOpened({
          orgId: meterFull.building.organizationId,
          buildingId: meterFull.buildingId,
          utilityMeterId,
          utilityAccountId: account.id,
          toPartyType: assignedPartyType,
          toPartyName: assignedPartyName || undefined,
          toTenantId: tenantId || undefined,
          accountNumber: accountNumber || undefined,
          providerName: meterFull.providerName || undefined,
          leaseStartSnapshot: account.leaseStartSnapshot || undefined,
          leaseEndSnapshot: account.leaseEndSnapshot || undefined,
          triggeredBy: "manual",
          triggeredByUserId: user.id,
        });
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to record utility event");
    }

    return NextResponse.json(account, { status: 201 });
  } catch (err: any) {
    if (err.message?.startsWith("CONFLICT:")) {
      return NextResponse.json({ error: err.message.replace("CONFLICT:", "") }, { status: 409 });
    }
    throw err;
  }
}, "utilities");
