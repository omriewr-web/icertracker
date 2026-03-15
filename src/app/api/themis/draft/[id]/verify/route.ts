import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { assertBuildingAccess } from "@/lib/data-scope";
import { z } from "zod";

export const dynamic = "force-dynamic";

const verifySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  category: z.enum(["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "GENERAL", "OTHER"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  trade: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
  incidentDate: z.string().nullable().optional(),
  accessAttempts: z.array(z.object({
    date: z.string(),
    result: z.string(),
    notes: z.string().optional(),
  })).nullable().optional(),
}).partial();

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const data = await parseBody(req, verifySchema);

  const draft = await prisma.workOrderDraft.findUnique({ where: { id }, select: { id: true, buildingId: true } });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const forbidden = await assertBuildingAccess(user, draft.buildingId);
  if (forbidden) return forbidden;

  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.trade !== undefined) updateData.trade = data.trade;
  if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;
  if (data.vendorId !== undefined) updateData.vendorId = data.vendorId;
  if (data.scheduledDate !== undefined) updateData.scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : null;
  if (data.incidentDate !== undefined) updateData.incidentDate = data.incidentDate ? new Date(data.incidentDate) : null;
  if (data.accessAttempts !== undefined) updateData.accessAttempts = data.accessAttempts;

  updateData.verifiedByUserId = user.id;
  updateData.verifiedAt = new Date();
  updateData.status = "verified";

  const updated = await prisma.workOrderDraft.update({ where: { id }, data: updateData });
  return NextResponse.json(updated);
}, "maintenance");
