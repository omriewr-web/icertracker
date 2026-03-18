import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { assertBuildingAccess } from "@/lib/data-scope";
import { changeOrderCreateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { buildingId: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await assertBuildingAccess(user, project.buildingId);
  if (denied) return denied;

  const orders = await prisma.projectChangeOrder.findMany({
    where: { projectId: id },
    orderBy: { requestedAt: "desc" },
  });

  return NextResponse.json(orders);
});

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { buildingId: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await assertBuildingAccess(user, project.buildingId);
  if (denied) return denied;

  const body = await parseBody(req, changeOrderCreateSchema);

  const order = await prisma.$transaction(async (tx) => {
    const co = await tx.projectChangeOrder.create({
      data: {
        projectId: id,
        title: body.title,
        description: body.description || null,
        amount: body.amount,
        status: body.status as any,
      },
    });

    await tx.projectActivity.create({
      data: {
        projectId: id,
        userId: user.id,
        action: "CHANGE_ORDER_CREATED",
        detail: `"${co.title}" — $${Number(co.amount).toLocaleString()}`,
      },
    });

    return co;
  });

  return NextResponse.json(order, { status: 201 });
}, "maintenance");
