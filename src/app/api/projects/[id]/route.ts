import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { assertBuildingAccess } from "@/lib/data-scope";
import { calculateHealth, calculatePercentComplete, computeProjectStats } from "@/lib/project-health";
import { toNumber } from "@/lib/utils/decimal";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      building: { select: { id: true, address: true, altAddress: true } },
      milestones: { orderBy: { createdAt: "asc" } },
      budgetLines: { orderBy: { createdAt: "asc" } },
      changeOrders: { orderBy: { requestedAt: "desc" } },
      activity: { orderBy: { createdAt: "desc" }, take: 20 },
      workOrders: true,
      violations: true,
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await assertBuildingAccess(user, project.buildingId);
  if (denied) return denied;

  const stats = computeProjectStats({
    status: project.status,
    approvedBudget: project.approvedBudget,
    estimatedBudget: project.estimatedBudget,
    actualCost: project.actualCost,
    targetEndDate: project.targetEndDate,
    startDate: project.startDate,
    requiresApproval: project.requiresApproval,
    percentComplete: project.percentComplete,
    milestones: project.milestones.map(m => ({ status: m.status, dueDate: m.dueDate, name: m.name })),
  });

  return NextResponse.json({ ...project, stats });
});

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const existing = await prisma.project.findUnique({
    where: { id },
    select: { buildingId: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await assertBuildingAccess(user, existing.buildingId);
  if (denied) return denied;

  const body = await req.json();

  const updateData: any = {};
  const fields = [
    "name", "description", "category", "status", "priority", "scopeOfWork",
    "code", "managerId", "vendorId", "ownerVisible", "requiresApproval",
  ];
  for (const f of fields) {
    if (body[f] !== undefined) updateData[f] = body[f];
  }
  const decimalFields = ["estimatedBudget", "approvedBudget", "actualCost", "contingency"];
  for (const f of decimalFields) {
    if (body[f] !== undefined) updateData[f] = body[f];
  }
  const dateFields = ["startDate", "targetEndDate", "actualEndDate"];
  for (const f of dateFields) {
    if (body[f] !== undefined) updateData[f] = body[f] ? new Date(body[f]) : null;
  }

  // Recalculate health + percent
  const milestones = await prisma.projectMilestone.findMany({
    where: { projectId: id },
    select: { status: true },
  });

  const updated = await prisma.$transaction(async (tx) => {
    const proj = await tx.project.update({ where: { id }, data: updateData });

    const health = calculateHealth({
      approvedBudget: proj.approvedBudget,
      actualCost: proj.actualCost,
      targetEndDate: proj.targetEndDate,
      status: proj.status,
      milestones,
    });
    const pct = calculatePercentComplete(milestones);

    const final = await tx.project.update({
      where: { id },
      data: { health, percentComplete: pct },
    });

    // Log changes
    const changes: string[] = [];
    if (body.status && body.status !== existing.status) changes.push(`Status → ${body.status}`);
    if (body.priority) changes.push(`Priority → ${body.priority}`);
    if (changes.length > 0) {
      await tx.projectActivity.create({
        data: {
          projectId: id,
          userId: user.id,
          action: "PROJECT_UPDATED",
          detail: changes.join(", "),
        },
      });
    }

    return final;
  });

  return NextResponse.json(updated);
}, "maintenance");

export const DELETE = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { buildingId: true, status: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await assertBuildingAccess(user, project.buildingId);
  if (denied) return denied;

  if (project.status !== "PLANNED") {
    return NextResponse.json({ error: "Only PLANNED projects can be deleted" }, { status: 400 });
  }

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}, "maintenance");
