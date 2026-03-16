import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { assertBuildingAccess } from "@/lib/data-scope";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { buildingId: true, status: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await assertBuildingAccess(user, project.buildingId);
  if (denied) return denied;

  const updated = await prisma.$transaction(async (tx) => {
    const approved = await tx.project.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
      },
    });

    await tx.projectActivity.create({
      data: {
        projectId: id,
        userId: user.id,
        action: "PROJECT_APPROVED",
        detail: `Approved by ${user.name}`,
      },
    });

    return approved;
  });

  return NextResponse.json(updated);
}, "edit");
