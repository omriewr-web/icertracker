import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { assertBuildingAccess } from "@/lib/data-scope";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { buildingId: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await assertBuildingAccess(user, project.buildingId);
  if (denied) return denied;

  const body = await req.json();
  const violationId = body.violationId;
  if (!violationId) return NextResponse.json({ error: "violationId required" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.projectViolation.upsert({
      where: { projectId_violationId: { projectId: id, violationId } },
      create: { projectId: id, violationId },
      update: {},
    });

    await tx.projectActivity.create({
      data: {
        projectId: id,
        userId: user.id,
        action: "VIOLATION_LINKED",
        detail: `Violation ${violationId} linked`,
      },
    });
  });

  return NextResponse.json({ success: true }, { status: 201 });
}, "maintenance");
