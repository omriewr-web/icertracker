import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const buildingSchema = z.object({
  address: z.string().min(1),
  borough: z.string().nullable().optional(),
  totalUnits: z.number().int().min(0).default(0),
  type: z.string().default("Residential"),
});

export const POST = withAuth(async (req, { user }) => {
  const data = await parseBody(req, buildingSchema);

  const building = await prisma.building.create({
    data: {
      address: data.address,
      borough: data.borough || null,
      totalUnits: data.totalUnits,
      type: data.type,
      organizationId: user.organizationId,
      yardiId: `manual-${Date.now().toString(36)}`,
    },
  });

  // Assign building to the creating user
  await prisma.userProperty.create({
    data: {
      userId: user.id,
      buildingId: building.id,
    },
  });

  return NextResponse.json(building, { status: 201 });
});
