import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { complianceItemUpdateSchema } from "@/lib/validations";
import { calculateNextDueDate } from "@/lib/compliance-templates";
import { getDisplayAddress } from "@/lib/building-matching";
import { assertComplianceAccess } from "@/lib/data-scope";
import type { ComplianceItemView } from "@/types";
import { toNumber } from "@/lib/utils/decimal";

export const dynamic = "force-dynamic";

function mapComplianceItem(item: any): ComplianceItemView {
  const nextDue = item.nextDueDate ? new Date(item.nextDueDate) : null;
  const now = new Date();
  const daysUntilDue = nextDue ? Math.ceil((nextDue.getTime() - now.getTime()) / 86400000) : null;

  return {
    id: item.id,
    buildingId: item.buildingId,
    buildingAddress: item.building ? getDisplayAddress(item.building) : "",
    type: item.type,
    category: item.category,
    name: item.name,
    description: item.description,
    dueDate: item.dueDate?.toISOString() || null,
    frequency: item.frequency,
    status: item.status,
    lastCompletedDate: item.lastCompletedDate?.toISOString() || null,
    nextDueDate: item.nextDueDate?.toISOString() || null,
    assignedVendorId: item.assignedVendorId,
    assignedVendorName: item.assignedVendor?.name || null,
    cost: toNumber(item.cost),
    filedBy: item.filedBy,
    certificateUrl: item.certificateUrl,
    notes: item.notes,
    linkedViolationId: item.linkedViolationId,
    isCustom: item.isCustom,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    daysUntilDue,
  };
}

export const PATCH = withAuth(async (req: NextRequest, { user, params }) => {
  const { id } = await params;
  const denied = await assertComplianceAccess(user, id);
  if (denied) return denied;

  const data = await parseBody(req, complianceItemUpdateSchema);

  const existing = await prisma.complianceItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: any = { ...data };

  // Parse date strings
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.lastCompletedDate !== undefined) updateData.lastCompletedDate = data.lastCompletedDate ? new Date(data.lastCompletedDate) : null;
  if (data.nextDueDate !== undefined) updateData.nextDueDate = data.nextDueDate ? new Date(data.nextDueDate) : null;

  // Auto-set lastCompletedDate + nextDueDate when status becomes COMPLIANT
  if (data.status === "COMPLIANT" && existing.status !== "COMPLIANT") {
    updateData.lastCompletedDate = new Date();
    const freq = data.frequency || existing.frequency;
    updateData.nextDueDate = calculateNextDueDate(freq as any);
  }

  const updated = await prisma.complianceItem.update({
    where: { id },
    data: updateData,
    include: {
      building: { select: { address: true, altAddress: true } },
      assignedVendor: { select: { name: true } },
    },
  });

  return NextResponse.json(mapComplianceItem(updated));
}, "compliance");

export const DELETE = withAuth(async (req: NextRequest, { user, params }) => {
  const { id } = await params;
  const denied = await assertComplianceAccess(user, id);
  if (denied) return denied;

  const item = await prisma.complianceItem.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!item.isCustom) {
    return NextResponse.json({ error: "Only custom items can be deleted" }, { status: 403 });
  }

  await prisma.complianceItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}, "compliance");
