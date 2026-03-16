import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { assertUnitAccess } from "@/lib/data-scope";
import { z } from "zod";

export const dynamic = "force-dynamic";

const rentSchema = z.object({
  action: z.enum(["propose", "approve"]),
  rent: z.number().min(0),
});

// Roles that can propose rent
const PROPOSE_ROLES = ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN", "PM", "BROKER"];
// Roles that can approve rent
const APPROVE_ROLES = ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN", "PM"];

export const POST = withAuth(async (req, { user, params }) => {
  const { unitId } = await params;
  const denied = await assertUnitAccess(user, unitId);
  if (denied) return denied;

  const { action, rent } = await parseBody(req, rentSchema);
  const now = new Date();

  if (action === "propose") {
    if (!PROPOSE_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions to propose rent" }, { status: 403 });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { vacancyStatus: true },
    });

    const statusUpdate: any = {};
    if (unit?.vacancyStatus === "READY_TO_SHOW") {
      statusUpdate.vacancyStatus = "RENT_PROPOSED";
      statusUpdate.statusChangedAt = now;
    }

    const updated = await prisma.unit.update({
      where: { id: unitId },
      data: {
        proposedRent: rent,
        rentProposedBy: user.id,
        rentProposedAt: now,
        ...statusUpdate,
      },
    });

    return NextResponse.json(updated);
  }

  if (action === "approve") {
    if (!APPROVE_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions to approve rent" }, { status: 403 });
    }

    const updated = await prisma.unit.update({
      where: { id: unitId },
      data: {
        approvedRent: rent,
        rentApprovedBy: user.id,
        rentApprovedAt: now,
        vacancyStatus: "RENT_APPROVED",
        statusChangedAt: now,
      },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}, "vac");
