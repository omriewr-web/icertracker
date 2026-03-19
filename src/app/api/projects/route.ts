import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { getBuildingScope, EMPTY_SCOPE, assertBuildingAccess } from "@/lib/data-scope";
import { getDisplayAddress } from "@/lib/building-matching";
import { toNumber } from "@/lib/utils/decimal";
import { projectCreateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const priority = url.searchParams.get("priority");
  const health = url.searchParams.get("health");

  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const isOwner = user.role === "OWNER";
  const where: any = { ...scope };
  if (isOwner) where.ownerVisible = true;
  if (status) where.status = status;
  if (category) where.category = category;
  if (priority) where.priority = priority;
  if (health) where.health = health;

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "200", 10) || 200));

  const projects = await prisma.project.findMany({
    where,
    include: {
      building: { select: { id: true, address: true, altAddress: true } },
      milestones: { select: { status: true } },
      _count: { select: { workOrders: true, violations: true, budgetLines: true } },
    },
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  const mapped = projects.map((p) => {
    if (isOwner) {
      return {
        id: p.id,
        name: p.name,
        buildingId: p.buildingId,
        buildingAddress: getDisplayAddress(p.building),
        status: p.status,
        health: p.health,
        approvedBudget: toNumber(p.approvedBudget),
        actualCost: toNumber(p.actualCost),
        percentComplete: p.percentComplete,
        targetEndDate: p.targetEndDate?.toISOString() ?? null,
      };
    }
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      status: p.status,
      priority: p.priority,
      health: p.health,
      percentComplete: p.percentComplete,
      buildingId: p.buildingId,
      buildingAddress: getDisplayAddress(p.building),
      estimatedBudget: toNumber(p.estimatedBudget),
      approvedBudget: toNumber(p.approvedBudget),
      actualCost: toNumber(p.actualCost),
      startDate: p.startDate?.toISOString() ?? null,
      targetEndDate: p.targetEndDate?.toISOString() ?? null,
      ownerVisible: p.ownerVisible,
      milestoneCount: p.milestones.length,
      milestonesComplete: p.milestones.filter((m) => m.status === "COMPLETED").length,
      workOrderCount: p._count.workOrders,
      violationCount: p._count.violations,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  return NextResponse.json(mapped);
}, "maintenance");

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, projectCreateSchema);

  const forbidden = await assertBuildingAccess(user, body.buildingId);
  if (forbidden) return forbidden;

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        orgId: user.organizationId || "",
        buildingId: body.buildingId,
        unitId: body.unitId || null,
        createdById: user.id,
        managerId: body.managerId || null,
        vendorId: body.vendorId || null,
        code: body.code || null,
        name: body.name,
        description: body.description || null,
        category: body.category as any,
        status: body.status as any || "PLANNED",
        priority: body.priority as any || "MEDIUM",
        scopeOfWork: body.scopeOfWork || null,
        estimatedBudget: body.estimatedBudget ?? null,
        ownerVisible: body.ownerVisible ?? false,
        requiresApproval: body.requiresApproval ?? false,
        startDate: body.startDate ? new Date(body.startDate) : null,
        targetEndDate: body.targetEndDate ? new Date(body.targetEndDate) : null,
      },
    });

    await tx.projectActivity.create({
      data: {
        projectId: created.id,
        userId: user.id,
        action: "PROJECT_CREATED",
        detail: `Project "${created.name}" created`,
      },
    });

    return created;
  });

  return NextResponse.json(project, { status: 201 });
}, "maintenance");
