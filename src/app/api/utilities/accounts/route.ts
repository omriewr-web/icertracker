import { NextRequest, NextResponse } from "next/server";
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

  const account = await prisma.utilityAccount.create({
    data: {
      utilityMeterId,
      accountNumber: accountNumber || null,
      assignedPartyType,
      assignedPartyName: assignedPartyName || null,
      tenantId: tenantId || null,
      startDate: startDate ? new Date(startDate) : null,
      status: "active",
      notes: notes || null,
    },
  });

  return NextResponse.json(account, { status: 201 });
}, "utilities");
