import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { assertUnitAccess } from "@/lib/data-scope";
import { z } from "zod";
import { VacancyStatus } from "@prisma/client";
import { syncVacancyState } from "@/lib/services/vacancy.service";
import { onUnitBecameVacant, onVacancyClosed } from "@/lib/utilities/utility-automation.service";

export const dynamic = "force-dynamic";

const statusSchema = z.object({
  status: z.nativeEnum(VacancyStatus),
});

// Statuses that represent a vacant unit
const VACANCY_STATUSES: VacancyStatus[] = [
  "VACANT", "PRE_TURNOVER", "TURNOVER", "READY_TO_SHOW",
  "RENT_PROPOSED", "RENT_APPROVED", "LISTED", "LEASED",
];

export const PATCH = withAuth(async (req, { user, params }) => {
  const { unitId } = await params;
  const denied = await assertUnitAccess(user, unitId);
  if (denied) return denied;

  const { status } = await parseBody(req, statusSchema);
  const now = new Date();

  // Get current unit state
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { buildingId: true, vacancyStatus: true, vacantSince: true, readyDate: true },
  });
  if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

  if (status === "TURNOVER" || status === "PRE_TURNOVER") {
    // Transition to turnover: unit update + turnover record creation in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        vacancyStatus: status,
        statusChangedAt: now,
      };
      // Auto-set vacantSince if not already set
      if (!unit.vacantSince) {
        updateData.vacantSince = now;
      }
      // Clear readyDate when going back to turnover
      if (unit.readyDate) {
        updateData.readyDate = null;
      }

      const updated = await tx.unit.update({
        where: { id: unitId },
        data: updateData,
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

    await syncVacancyState(unitId);

    // Fire utility automation — non-blocking
    if (!unit.vacancyStatus || unit.vacancyStatus === "OCCUPIED") {
      try {
        const building = await prisma.building.findUnique({ where: { id: unit.buildingId }, select: { organizationId: true } });
        if (building?.organizationId) {
          onUnitBecameVacant({ orgId: building.organizationId, buildingId: unit.buildingId, unitId, triggeredByUserId: user.id }).catch(() => {});
        }
      } catch {}
    }

    return NextResponse.json(result);
  }

  if (status === "OCCUPIED") {
    // Transition to occupied: clear vacancy fields + close active turnover
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.unit.update({
        where: { id: unitId },
        data: {
          vacancyStatus: "OCCUPIED",
          isVacant: false,
          statusChangedAt: now,
          vacantSince: null,
          readyDate: null,
        },
      });

      await tx.turnoverWorkflow.updateMany({
        where: { unitId, isActive: true },
        data: { isActive: false, completedAt: now, status: "COMPLETE" },
      });

      return updated;
    });

    await syncVacancyState(unitId);

    // Fire utility automation — non-blocking
    if (VACANCY_STATUSES.includes(unit.vacancyStatus!)) {
      try {
        const building = await prisma.building.findUnique({ where: { id: unit.buildingId }, select: { organizationId: true } });
        if (building?.organizationId) {
          onVacancyClosed({ orgId: building.organizationId, unitId }).catch(() => {});
        }
      } catch {}
    }

    return NextResponse.json(result);
  }

  // Build update data for other status transitions
  const updateData: any = {
    vacancyStatus: status,
    statusChangedAt: now,
  };

  // Auto-set vacantSince if transitioning to any vacancy status and not set
  if (VACANCY_STATUSES.includes(status) && !unit.vacantSince) {
    updateData.vacantSince = now;
  }

  // Auto-set readyDate when transitioning to READY_TO_SHOW
  if (status === "READY_TO_SHOW") {
    updateData.readyDate = now;
  }

  // Clear readyDate if moving backwards from READY_TO_SHOW
  if (unit.vacancyStatus === "READY_TO_SHOW" && status !== "READY_TO_SHOW") {
    updateData.readyDate = null;
  }

  const updated = await prisma.unit.update({
    where: { id: unitId },
    data: updateData,
  });

  await syncVacancyState(unitId);

  // Fire utility automation for transitions to vacancy statuses — non-blocking
  if (VACANCY_STATUSES.includes(status) && (!unit.vacancyStatus || unit.vacancyStatus === "OCCUPIED")) {
    try {
      const building = await prisma.building.findUnique({ where: { id: unit.buildingId }, select: { organizationId: true } });
      if (building?.organizationId) {
        onUnitBecameVacant({ orgId: building.organizationId, buildingId: unit.buildingId, unitId, triggeredByUserId: user.id }).catch(() => {});
      }
    } catch {}
  }

  return NextResponse.json(updated);
}, "vac");
