import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const orgId = user.organizationId;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const task = await prisma.utilityTask.findFirst({
    where: { id, orgId },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}, "utilities");

const taskUpdateSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "skipped", "escalated"]).optional(),
  notes: z.string().nullable().optional(),
  proofFileUrl: z.string().nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
});

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const orgId = user.organizationId;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = await parseBody(req, taskUpdateSchema);

  // Verify task belongs to this org
  const existing = await prisma.utilityTask.findFirst({
    where: { id, orgId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: Record<string, unknown> = {};

  if (body.status !== undefined) {
    updateData.status = body.status;
    if (body.status === "completed" || body.status === "skipped") {
      updateData.completedAt = new Date();
      updateData.completedByUserId = user.id;
    }
  }
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.proofFileUrl !== undefined) updateData.proofFileUrl = body.proofFileUrl;
  if (body.assignedToUserId !== undefined) updateData.assignedToUserId = body.assignedToUserId;

  const task = await prisma.utilityTask.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(task);
}, "utilities");
