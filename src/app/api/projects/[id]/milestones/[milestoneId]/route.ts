import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { assertBuildingAccess } from "@/lib/data-scope";
import { calculateHealth, calculatePercentComplete } from "@/lib/project-health";
import { milestoneUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id, milestoneId } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { buildingId: true, approvedBudget: true, actualCost: true, targetEndDate: true, status: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await assertBuildingAccess(user, project.buildingId);
  if (denied) return denied;

  const body = await parseBody(req, milestoneUpdateSchema);

  const updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.status === "COMPLETED") updateData.completedAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const milestone = await tx.projectMilestone.update({
      where: { id: milestoneId },
      data: updateData,
    });

    // Recalculate parent project health + percentComplete
    const milestones = await tx.projectMilestone.findMany({
      where: { projectId: id },
      select: { status: true },
    });

    const health = calculateHealth({ ...project, milestones });
    const pct = calculatePercentComplete(milestones);

    await tx.project.update({
      where: { id },
      data: { health, percentComplete: pct },
    });

    await tx.projectActivity.create({
      data: {
        projectId: id,
        userId: user.id,
        action: "MILESTONE_UPDATED",
        detail: `"${milestone.name}" → ${milestone.status}`,
      },
    });

    return milestone;
  });

  return NextResponse.json(updated);
}, "maintenance");
