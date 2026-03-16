import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { assertUnitAccess } from "@/lib/data-scope";
import { z } from "zod";
import { VacancyStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const statusSchema = z.object({
  status: z.nativeEnum(VacancyStatus),
});

export const PATCH = withAuth(async (req, { user, params }) => {
  const { unitId } = await params;
  const denied = await assertUnitAccess(user, unitId);
  if (denied) return denied;

  const { status } = await parseBody(req, statusSchema);
  const now = new Date();

  // Get current unit for building context
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { buildingId: true, vacancyStatus: true },
  });
  if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

  if (status === "TURNOVER" || status === "PRE_TURNOVER") {
    // Transition to turnover: unit update + turnover record creation in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.unit.update({
        where: { id: unitId },
        data: { vacancyStatus: status, statusChangedAt: now },
      });

      // Upsert active turnover
      const existingTurnover = await tx.turnoverWorkflow.findFirst({
        where: { unitId, isActive: true },
      });
      if (!existingTurnover) {
        await tx.turnoverWorkflow.create({
          data: {
            unitId,
            buildingId: unit.buildingId,
            triggeredBy: "MANUAL",
            status: "PENDING_INSPECTION",
            isActive: true,
          },
        });
      }

      return updated;
    });

    return NextResponse.json(result);
  }

  if (status === "OCCUPIED") {
    // Transition to occupied: set isVacant=false + close active turnover
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.unit.update({
        where: { id: unitId },
        data: { vacancyStatus: "OCCUPIED", isVacant: false, statusChangedAt: now },
      });

      await tx.turnoverWorkflow.updateMany({
        where: { unitId, isActive: true },
        data: { isActive: false, completedAt: now, status: "COMPLETE" },
      });

      return updated;
    });

    return NextResponse.json(result);
  }

  // If transitioning to READY_TO_SHOW, set readyDate
  const extraData: any = {};
  if (status === "READY_TO_SHOW") {
    extraData.readyDate = now;
  }

  // Default: simple status update
  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: { vacancyStatus: status, statusChangedAt: now, ...extraData },
  });

  return NextResponse.json(updated);
}, "vac");
