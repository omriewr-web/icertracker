import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { assertBuildingAccess } from "@/lib/data-scope";
import { z } from "zod";

export const dynamic = "force-dynamic";

const packetCreateSchema = z.object({
  buildingId: z.string().min(1),
  violationIds: z.array(z.string().min(1)).min(1),
  agency: z.string().min(1),
  certifyByDate: z.string().optional(),
});

export const POST = withAuth(async (req, { user }) => {
  // ADMIN only
  if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "ADMIN role required" }, { status: 403 });
  }

  const body = await req.json();
  const data = packetCreateSchema.parse(body);

  const accessDenied = await assertBuildingAccess(user, data.buildingId);
  if (accessDenied) return accessDenied;

  // Validate all violations are PM_VERIFIED
  const violations = await prisma.violation.findMany({
    where: { id: { in: data.violationIds } },
    select: { id: true, lifecycleStatus: true, buildingId: true },
  });

  const notVerified = violations.filter((v) => v.lifecycleStatus !== "PM_VERIFIED");
  if (notVerified.length > 0) {
    return NextResponse.json(
      { error: `${notVerified.length} violation(s) are not PM_VERIFIED`, ids: notVerified.map((v) => v.id) },
      { status: 400 },
    );
  }

  const wrongBuilding = violations.filter((v) => v.buildingId !== data.buildingId);
  if (wrongBuilding.length > 0) {
    return NextResponse.json({ error: "Some violations do not belong to the specified building" }, { status: 400 });
  }

  // Create packet + items in transaction
  const packet = await prisma.$transaction(async (tx) => {
    const building = await tx.building.findUnique({
      where: { id: data.buildingId },
      select: { organizationId: true },
    });

    const created = await tx.certificationPacket.create({
      data: {
        organizationId: building?.organizationId ?? null,
        buildingId: data.buildingId,
        agency: data.agency,
        preparedById: user.id,
        certifyByDate: data.certifyByDate ? new Date(data.certifyByDate) : null,
        items: {
          create: data.violationIds.map((violationId) => ({
            violationId,
          })),
        },
      },
      include: {
        items: { include: { violation: { select: { id: true, externalId: true, description: true, class: true } } } },
      },
    });

    // Update violations to CERTIFICATION_READY
    await tx.violation.updateMany({
      where: { id: { in: data.violationIds } },
      data: { lifecycleStatus: "CERTIFICATION_READY" },
    });

    return created;
  });

  return NextResponse.json(packet, { status: 201 });
}, "maintenance");

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");

  if (!buildingId) {
    return NextResponse.json({ error: "buildingId query param required" }, { status: 400 });
  }

  const accessDenied = await assertBuildingAccess(user, buildingId);
  if (accessDenied) return accessDenied;

  const packets = await prisma.certificationPacket.findMany({
    where: { buildingId },
    orderBy: { createdAt: "desc" },
    include: {
      preparedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      items: {
        include: {
          violation: {
            select: {
              id: true,
              externalId: true,
              description: true,
              class: true,
              source: true,
              lifecycleStatus: true,
              certifyByDate: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json(packets);
}, "maintenance");
