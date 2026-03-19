import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { assertBuildingAccess } from "@/lib/data-scope";
import { budgetLineCreateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { buildingId: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await assertBuildingAccess(user, project.buildingId);
  if (denied) return denied;

  const lines = await prisma.projectBudgetLine.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(lines);
});

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { buildingId: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await assertBuildingAccess(user, project.buildingId);
  if (denied) return denied;

  const body = await parseBody(req, budgetLineCreateSchema);

  const line = await prisma.projectBudgetLine.create({
    data: {
      projectId: id,
      category: body.category,
      description: body.description || null,
      estimated: body.estimated,
      actual: body.actual ?? null,
    },
  });

  return NextResponse.json(line, { status: 201 });
}, "maintenance");
