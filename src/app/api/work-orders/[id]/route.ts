import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { workOrderUpdateSchema } from "@/lib/validations";
import { assertWorkOrderAccess } from "@/lib/data-scope";

const include = {
  building: { select: { address: true } },
  unit: { select: { unitNumber: true } },
  tenant: { select: { name: true } },
  vendor: { select: { name: true } },
  assignedTo: { select: { name: true } },
  createdBy: { select: { name: true } },
  comments: {
    orderBy: { createdAt: "desc" as const },
    include: { author: { select: { name: true } } },
  },
  _count: { select: { comments: true } },
};

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertWorkOrderAccess(user, id);
  if (denied) return denied;

  const wo = await prisma.workOrder.findUnique({ where: { id }, include });
  if (!wo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(wo);
}, "maintenance");

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertWorkOrderAccess(user, id);
  if (denied) return denied;
  const data = await parseBody(req, workOrderUpdateSchema);

  const updateData: any = { ...data };
  if (data.scheduledDate !== undefined) {
    updateData.scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : null;
  }
  if (data.completedDate !== undefined) {
    updateData.completedDate = data.completedDate ? new Date(data.completedDate) : null;
  }
  if (data.status === "COMPLETED" && !data.completedDate) {
    updateData.completedDate = new Date();
  }

  const wo = await prisma.workOrder.update({ where: { id }, data: updateData, include });
  return NextResponse.json(wo);
}, "maintenance");

export const DELETE = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertWorkOrderAccess(user, id);
  if (denied) return denied;

  await prisma.workOrder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}, "maintenance");
