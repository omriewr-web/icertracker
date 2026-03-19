import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getBuildingScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { getDisplayAddress } from "@/lib/building-matching";
import type { ViolationView } from "@/types";

export const dynamic = "force-dynamic";

function mapViolation(v: any): ViolationView {
  const respondBy = v.respondByDate ? new Date(v.respondByDate) : null;
  const now = new Date();
  const daysUntilCure = respondBy ? Math.ceil((respondBy.getTime() - now.getTime()) / 86400000) : null;

  return {
    id: v.id,
    buildingId: v.buildingId,
    buildingAddress: v.building ? getDisplayAddress(v.building) : "",
    source: v.source,
    externalId: v.externalId,
    class: v.class,
    severity: v.severity,
    description: v.description,
    inspectionDate: v.inspectionDate?.toISOString() || null,
    issuedDate: v.issuedDate?.toISOString() || null,
    currentStatus: v.currentStatus,
    penaltyAmount: Number(v.penaltyAmount),
    respondByDate: v.respondByDate?.toISOString() || null,
    certifiedDismissDate: v.certifiedDismissDate?.toISOString() || null,
    correctionDate: v.correctionDate?.toISOString() || null,
    unitNumber: v.unitNumber,
    novDescription: v.novDescription,
    hearingDate: v.hearingDate?.toISOString() || null,
    hearingStatus: v.hearingStatus,
    linkedWorkOrderId: v.linkedWorkOrderId,
    lifecycleStatus: v.lifecycleStatus || "INGESTED",
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    daysUntilCure,
  };
}

export const GET = withAuth(async (req: NextRequest, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const source = url.searchParams.get("source");
  const vClass = url.searchParams.get("class");
  const status = url.searchParams.get("status");
  const isComplaint = url.searchParams.get("isComplaint");
  const lifecycleStatus = url.searchParams.get("lifecycleStatus");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const where: any = { ...scope };

  if (source) where.source = source;
  if (vClass) where.class = vClass;
  if (status) where.currentStatus = { contains: status, mode: "insensitive" };
  if (lifecycleStatus) where.lifecycleStatus = lifecycleStatus;

  if (isComplaint === "true") {
    where.source = { in: ["HPD_COMPLAINTS", "DOB_COMPLAINTS"] };
  } else if (isComplaint === "false") {
    where.source = { notIn: ["HPD_COMPLAINTS", "DOB_COMPLAINTS"] };
  }

  if (dateFrom || dateTo) {
    where.issuedDate = {};
    if (dateFrom) where.issuedDate.gte = new Date(dateFrom);
    if (dateTo) where.issuedDate.lte = new Date(dateTo);
  }

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "200", 10) || 200));

  const violations = await prisma.violation.findMany({
    where,
    include: { building: { select: { address: true, altAddress: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json(violations.map(mapViolation));
}, "compliance");
