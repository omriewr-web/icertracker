import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getDisplayAddress } from "@/lib/building-matching";

export const POST = withAuth(async (req: NextRequest, { user, params }) => {
  const { id } = await params;

  const violation = await prisma.violation.findUnique({
    where: { id },
    include: { building: { select: { address: true, altAddress: true } } },
  });

  if (!violation) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  if (violation.linkedWorkOrderId) {
    return NextResponse.json({ error: "Violation already has a linked work order" }, { status: 409 });
  }

  const buildingAddress = violation.building ? getDisplayAddress(violation.building) : "";

  const workOrder = await prisma.workOrder.create({
    data: {
      title: `${violation.source} Violation ${violation.externalId} — ${buildingAddress}`,
      description: violation.description,
      status: "OPEN",
      priority: violation.class === "C" ? "URGENT" : violation.class === "B" ? "HIGH" : "MEDIUM",
      category: "GENERAL",
      buildingId: violation.buildingId,
      unitId: violation.unitId,
      sourceType: "violation",
      sourceId: violation.id,
      violationId: violation.id,
      createdById: user.id,
    },
  });

  await prisma.violation.update({
    where: { id },
    data: {
      linkedWorkOrderId: workOrder.id,
      lifecycleStatus: "DISPATCHED",
    },
  });

  return NextResponse.json(workOrder, { status: 201 });
}, "compliance");
