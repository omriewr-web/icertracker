import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { assertBuildingAccess } from "@/lib/data-scope";
import { linkWorkOrderSchema } from "@/lib/validations";
import { assertLinkedWorkOrderMatchesBuilding } from "@/lib/work-order-relations";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { buildingId: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await assertBuildingAccess(user, project.buildingId);
  if (denied) return denied;

  const { workOrderId } = await parseBody(req, linkWorkOrderSchema);
  await assertLinkedWorkOrderMatchesBuilding(workOrderId, project.buildingId);

  await prisma.$transaction(async (tx) => {
    await tx.projectWorkOrder.upsert({
      where: { projectId_workOrderId: { projectId: id, workOrderId } },
      create: { projectId: id, workOrderId },
      update: {},
    });

    await tx.projectActivity.create({
      data: {
        projectId: id,
        userId: user.id,
        action: "WORK_ORDER_LINKED",
        detail: `Work order ${workOrderId} linked`,
      },
    });
  });

  return NextResponse.json({ success: true }, { status: 201 });
}, "maintenance");
