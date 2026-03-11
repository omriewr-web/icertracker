import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { canAccessBuilding } from "@/lib/data-scope";
import { z } from "zod";

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["assign_vendor", "assign_user", "change_status", "change_priority"]),
  value: z.string(),
});

export const POST = withAuth(async (req, { user }) => {
  const body = await req.json();
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.errors }, { status: 400 });
  }

  const { ids, action, value } = parsed.data;

  // Verify all work orders belong to buildings the user can access
  const workOrders = await prisma.workOrder.findMany({
    where: { id: { in: ids } },
    select: { id: true, buildingId: true, status: true, priority: true, vendorId: true, assignedToId: true },
  });

  if (workOrders.length !== ids.length) {
    return NextResponse.json({ error: "One or more work order IDs not found" }, { status: 404 });
  }

  for (const wo of workOrders) {
    if (!canAccessBuilding(user, wo.buildingId)) {
      return NextResponse.json({ error: "Forbidden — one or more work orders are out of scope" }, { status: 403 });
    }
  }

  // Build update data and activity entries
  const actionFieldMap: Record<string, string> = {
    assign_vendor: "vendorId",
    assign_user: "assignedToId",
    change_status: "status",
    change_priority: "priority",
  };
  const actionLogMap: Record<string, string> = {
    assign_vendor: "vendor_assigned",
    assign_user: "user_assigned",
    change_status: "status_changed",
    change_priority: "priority_changed",
  };

  const field = actionFieldMap[action];
  const activityAction = actionLogMap[action];
  const updateValue = action === "assign_vendor" || action === "assign_user"
    ? (value || null)
    : value;

  const result = await prisma.$transaction(async (tx) => {
    // Build activity entries
    const activities = workOrders.map((wo) => {
      const currentValue = action === "assign_vendor" ? wo.vendorId
        : action === "assign_user" ? wo.assignedToId
        : action === "change_status" ? wo.status
        : wo.priority;
      return {
        workOrderId: wo.id,
        userId: user.id,
        action: activityAction,
        fromValue: currentValue ?? null,
        toValue: updateValue,
      };
    }).filter((a) => a.fromValue !== a.toValue);

    // Build individual updates for status=COMPLETED auto-date
    const updateData: any = { [field]: updateValue };
    if (action === "change_status" && value === "COMPLETED") {
      updateData.completedDate = new Date();
    }

    await tx.workOrder.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    });

    if (activities.length > 0) {
      await tx.workOrderActivity.createMany({ data: activities });
    }

    return { updated: ids.length, logged: activities.length };
  });

  return NextResponse.json(result);
}, "maintenance");
