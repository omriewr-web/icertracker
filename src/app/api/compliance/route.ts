import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { complianceItemCreateSchema } from "@/lib/validations";
import { getBuildingScope, EMPTY_SCOPE, assertBuildingAccess } from "@/lib/data-scope";
import { getDisplayAddress } from "@/lib/building-matching";
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

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const frequency = url.searchParams.get("frequency");

  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const where: any = { ...scope };

  if (category) where.category = category;
  if (status) where.status = status;
  if (frequency) where.frequency = frequency;

  const items = await prisma.complianceItem.findMany({
    where,
    include: {
      building: { select: { address: true, altAddress: true } },
      assignedVendor: { select: { name: true } },
    },
    orderBy: { nextDueDate: "asc" },
  });

  return NextResponse.json(items.map(mapComplianceItem));
}, "compliance");

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const data = await parseBody(req, complianceItemCreateSchema);

  // Verify building access
  const accessErr = await assertBuildingAccess(user, data.buildingId);
  if (accessErr) return accessErr;

  const item = await prisma.complianceItem.create({
    data: {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      lastCompletedDate: data.lastCompletedDate ? new Date(data.lastCompletedDate) : undefined,
      nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined,
    },
    include: {
      building: { select: { address: true, altAddress: true } },
      assignedVendor: { select: { name: true } },
    },
  });

  return NextResponse.json(mapComplianceItem(item), { status: 201 });
}, "compliance");
