import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const taskType = url.searchParams.get("taskType");
  const unitId = url.searchParams.get("unitId");
  const buildingId = url.searchParams.get("buildingId");
  const overdue = url.searchParams.get("overdue");

  const orgId = user.organizationId;
  if (!orgId) return NextResponse.json([]);

  const where: Record<string, unknown> = { orgId };
  if (status) where.status = status;
  if (taskType) where.taskType = taskType;
  if (unitId) where.unitId = unitId;
  if (buildingId) where.buildingId = buildingId;
  if (overdue === "true") {
    where.status = { in: ["pending", "in_progress"] };
    where.dueAt = { lt: new Date() };
  }

  const tasks = await prisma.utilityTask.findMany({
    where,
    orderBy: { dueAt: "asc" },
    take: 200,
  });

  return NextResponse.json(tasks);
}, "utilities");

const taskCreateSchema = z.object({
  buildingId: z.string().min(1),
  unitId: z.string().nullable().optional(),
  utilityMeterId: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  taskType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
});

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, taskCreateSchema);
  const orgId = user.organizationId;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const task = await prisma.utilityTask.create({
    data: {
      orgId,
      buildingId: body.buildingId,
      unitId: body.unitId || null,
      utilityMeterId: body.utilityMeterId || null,
      tenantId: body.tenantId || null,
      taskType: body.taskType as any,
      title: body.title,
      description: body.description || null,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      assignedToUserId: body.assignedToUserId || null,
      triggeredBy: "manual",
    },
  });

  return NextResponse.json(task, { status: 201 });
}, "utilities");
