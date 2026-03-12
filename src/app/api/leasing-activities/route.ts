// Permission: "vac" — leasing activity log for vacant units
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { getBuildingScope, EMPTY_SCOPE, assertBuildingAccess } from "@/lib/data-scope";
import { leasingActivityCreateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const unitId = url.searchParams.get("unitId");
  const buildingId = url.searchParams.get("buildingId");

  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const where: any = { ...scope };
  if (unitId) where.unitId = unitId;

  const activities = await prisma.leasingActivity.findMany({
    where,
    include: {
      user: { select: { name: true } },
      unit: { select: { unitNumber: true } },
      building: { select: { address: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(
    activities.map((a) => ({
      id: a.id,
      unitId: a.unitId,
      buildingId: a.buildingId,
      type: a.type,
      description: a.description,
      contactName: a.contactName,
      contactInfo: a.contactInfo,
      createdAt: a.createdAt.toISOString(),
      userName: a.user.name,
      unitNumber: a.unit.unitNumber,
      buildingAddress: a.building.address,
    }))
  );
}, "vac");

export const POST = withAuth(async (req, { user }) => {
  const { unitId, buildingId, type, description, contactName, contactInfo } = await parseBody(req, leasingActivityCreateSchema);

  const accessErr = await assertBuildingAccess(user, buildingId);
  if (accessErr) return accessErr;

  const activity = await prisma.leasingActivity.create({
    data: {
      unitId,
      buildingId,
      userId: user.id,
      type,
      description: description || null,
      contactName: contactName || null,
      contactInfo: contactInfo || null,
    },
  });

  return NextResponse.json(activity, { status: 201 });
}, "vac");
