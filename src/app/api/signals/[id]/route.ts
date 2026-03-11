import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { canAccessBuilding } from "@/lib/data-scope";

// PATCH /api/signals/[id] — acknowledge, resolve, or update fields
export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const body = await req.json();
  const action = body.action as string | undefined;

  const signal = await prisma.operationalSignal.findUnique({ where: { id } });
  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  // Scope check: non-admin users can only modify signals for their buildings
  if (signal.buildingId && !canAccessBuilding(user, signal.buildingId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Action-based updates
  if (action === "acknowledge") {
    const updated = await prisma.operationalSignal.update({
      where: { id },
      data: { status: "acknowledged", acknowledgedAt: new Date(), acknowledgedById: user.id },
    });
    return NextResponse.json(updated);
  }

  if (action === "resolve") {
    const updated = await prisma.operationalSignal.update({
      where: { id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        resolvedById: user.id,
        resolutionNote: body.resolutionNote || undefined,
      },
    });
    return NextResponse.json(updated);
  }

  // Field-level updates (assign, due date, snooze)
  const updateData: any = {};
  if (body.assignedToUserId !== undefined) updateData.assignedToUserId = body.assignedToUserId || null;
  if (body.dueAt !== undefined) updateData.dueAt = body.dueAt ? new Date(body.dueAt) : null;
  if (body.snoozedUntil !== undefined) updateData.snoozedUntil = body.snoozedUntil ? new Date(body.snoozedUntil) : null;

  if (Object.keys(updateData).length === 0 && !action) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.operationalSignal.update({
    where: { id },
    data: updateData,
  });
  return NextResponse.json(updated);
}, "dash");
