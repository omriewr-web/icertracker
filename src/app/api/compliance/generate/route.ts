import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { complianceGenerateSchema } from "@/lib/validations";
import { generateDefaultComplianceItems } from "@/lib/compliance-templates";
import { assertBuildingAccess } from "@/lib/data-scope";

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const { buildingId } = await parseBody(req, complianceGenerateSchema);

  const denied = await assertBuildingAccess(user, buildingId);
  if (denied) return denied;

  // Check building exists
  const building = await prisma.building.findUnique({ where: { id: buildingId } });
  if (!building) {
    return NextResponse.json({ error: "Building not found" }, { status: 404 });
  }

  // Get existing compliance items for this building to avoid duplicates
  const existing = await prisma.complianceItem.findMany({
    where: { buildingId },
    select: { type: true },
  });
  const existingTypes = new Set(existing.map((e) => e.type));

  const templates = generateDefaultComplianceItems(buildingId);
  const toCreate = templates.filter((t) => !existingTypes.has(t.type));

  if (toCreate.length === 0) {
    return NextResponse.json({ message: "All defaults already exist", created: 0 });
  }

  await prisma.complianceItem.createMany({ data: toCreate });

  return NextResponse.json({ message: `Created ${toCreate.length} compliance items`, created: toCreate.length }, { status: 201 });
}, "compliance");
