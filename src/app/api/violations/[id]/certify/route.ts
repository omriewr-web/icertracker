import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { assertBuildingAccess } from "@/lib/data-scope";
import { violationCertifySchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  // Only PM/ADMIN roles
  if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN", "PM"].includes(user.role)) {
    return NextResponse.json({ error: "PM or ADMIN role required" }, { status: 403 });
  }

  const body = await parseBody(req, violationCertifySchema);
  const notes = body.notes ?? null;

  const violation = await prisma.violation.findUnique({
    where: { id },
    select: {
      id: true,
      buildingId: true,
      linkedWorkOrderId: true,
      lifecycleStatus: true,
    },
  });

  if (!violation) {
    return NextResponse.json({ error: "Violation not found" }, { status: 404 });
  }

  const accessDenied = await assertBuildingAccess(user, violation.buildingId);
  if (accessDenied) return accessDenied;

  // Validate: must have a linked WO
  if (!violation.linkedWorkOrderId) {
    return NextResponse.json({ error: "No linked work order" }, { status: 400 });
  }

  // Validate: WO must be COMPLETED
  const wo = await prisma.workOrder.findUnique({
    where: { id: violation.linkedWorkOrderId },
    select: { id: true, status: true },
  });
  if (!wo || wo.status !== "COMPLETED") {
    return NextResponse.json({ error: "Work order must be COMPLETED before PM verification" }, { status: 400 });
  }

  // Validate: at least one AFTER evidence photo
  const afterEvidence = await prisma.evidence.findFirst({
    where: { workOrderId: wo.id, type: "AFTER" },
  });
  if (!afterEvidence) {
    return NextResponse.json({ error: "At least one AFTER evidence photo is required" }, { status: 400 });
  }

  // Update violation lifecycle
  await prisma.violation.update({
    where: { id },
    data: {
      lifecycleStatus: "PM_VERIFIED",
      pmVerifiedAt: new Date(),
      pmVerifiedById: user.id,
    },
  });

  // Create ActivityEvent
  await prisma.activityEvent.create({
    data: {
      eventType: "violation_pm_verified",
      title: "Violation PM Verified",
      description: notes,
      buildingId: violation.buildingId,
      relatedRecordType: "Violation",
      relatedRecordId: id,
      createdByUserId: user.id,
    },
  });

  return NextResponse.json({ success: true, lifecycleStatus: "PM_VERIFIED" });
}, "maintenance");
