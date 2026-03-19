import { prisma } from "@/lib/prisma";
import type { VacancyStatus, TurnoverStatus } from "@prisma/client";

// ── Mapping: VacancyStatus → expected states on related models ──

/** Vacancy statuses where Unit.isVacant should be true */
const VACANT_STATUSES: VacancyStatus[] = [
  "VACANT", "PRE_TURNOVER", "TURNOVER", "READY_TO_SHOW",
  "RENT_PROPOSED", "RENT_APPROVED", "LISTED", "LEASED",
];

/** VacancyStatus → Vacancy.stage mapping */
const VACANCY_STAGE_MAP: Partial<Record<VacancyStatus, string>> = {
  VACANT: "vacant",
  PRE_TURNOVER: "vacant",
  TURNOVER: "renovation",
  READY_TO_SHOW: "listed",
  RENT_PROPOSED: "listed",
  RENT_APPROVED: "listed",
  LISTED: "listed",
  LEASED: "lease_signed",
};

/** VacancyStatus → TurnoverWorkflow.status mapping (approximate best-fit) */
const TURNOVER_STATUS_MAP: Partial<Record<VacancyStatus, TurnoverStatus>> = {
  PRE_TURNOVER: "PENDING_INSPECTION",
  TURNOVER: "SCOPE_CREATED",
  READY_TO_SHOW: "READY_TO_LIST",
  RENT_PROPOSED: "READY_TO_LIST",
  RENT_APPROVED: "READY_TO_LIST",
  LISTED: "LISTED",
  LEASED: "COMPLETE",
};

interface SyncResult {
  unitId: string;
  vacancyStatus: VacancyStatus | null;
  isVacant: boolean;
  hadDrift: boolean;
  changes: string[];
}

/**
 * Canonical function for synchronising vacancy state across all related models.
 * Unit is the single source of truth — VacancyInfo, Vacancy, TurnoverWorkflow follow.
 */
export async function syncVacancyState(unitId: string): Promise<SyncResult> {
  return prisma.$transaction(async (tx) => {
    const unit = await tx.unit.findUniqueOrThrow({
      where: { id: unitId },
      select: {
        id: true,
        buildingId: true,
        isVacant: true,
        vacancyStatus: true,
        vacantSince: true,
        readyDate: true,
        vacancyInfo: { select: { id: true } },
        vacancies: {
          where: { isActive: true },
          select: { id: true, stage: true },
          take: 1,
        },
        turnoverWorkflows: {
          where: { isActive: true },
          select: { id: true, status: true },
          take: 1,
        },
        tenant: { select: { id: true } },
      },
    });

    const status = unit.vacancyStatus;
    const shouldBeVacant = status != null && VACANT_STATUSES.includes(status);
    const shouldBeOccupied = status === "OCCUPIED" || status === null;
    const changes: string[] = [];

    // 1. Sync Unit.isVacant to match vacancyStatus
    if (shouldBeVacant && !unit.isVacant) {
      await tx.unit.update({ where: { id: unitId }, data: { isVacant: true } });
      changes.push("Unit.isVacant: false → true");
    } else if (shouldBeOccupied && unit.isVacant) {
      await tx.unit.update({
        where: { id: unitId },
        data: { isVacant: false, vacantSince: null, readyDate: null },
      });
      changes.push("Unit.isVacant: true → false");
    }

    // 2. Sync VacancyInfo (exists when vacant, removed when occupied)
    if (shouldBeVacant && !unit.vacancyInfo) {
      await tx.vacancyInfo.create({ data: { unitId } });
      changes.push("VacancyInfo: created");
    } else if (shouldBeOccupied && unit.vacancyInfo) {
      await tx.vacancyInfo.delete({ where: { unitId } });
      changes.push("VacancyInfo: deleted");
    }

    // 3. Sync active Vacancy record
    const activeVacancy = unit.vacancies[0];
    if (shouldBeVacant) {
      const expectedStage = VACANCY_STAGE_MAP[status!] ?? "vacant";
      if (activeVacancy) {
        if (activeVacancy.stage !== expectedStage) {
          await tx.vacancy.update({
            where: { id: activeVacancy.id },
            data: { stage: expectedStage },
          });
          changes.push(`Vacancy.stage: ${activeVacancy.stage} → ${expectedStage}`);
        }
      } else {
        await tx.vacancy.create({
          data: {
            buildingId: unit.buildingId,
            unitId,
            stage: expectedStage,
            isActive: true,
          },
        });
        changes.push(`Vacancy: created (stage=${expectedStage})`);
      }
    } else if (shouldBeOccupied && activeVacancy) {
      await tx.vacancy.update({
        where: { id: activeVacancy.id },
        data: { isActive: false },
      });
      changes.push("Vacancy: deactivated");
    }

    // 4. Sync TurnoverWorkflow
    const activeTurnover = unit.turnoverWorkflows[0];
    if (shouldBeVacant && status !== "VACANT") {
      const expectedTurnoverStatus = TURNOVER_STATUS_MAP[status!];
      if (activeTurnover && expectedTurnoverStatus) {
        // Only advance forward (don't regress turnover status)
        const TURNOVER_ORDER: TurnoverStatus[] = [
          "PENDING_INSPECTION", "INSPECTION_DONE", "SCOPE_CREATED",
          "VENDORS_ASSIGNED", "READY_TO_LIST", "LISTED", "COMPLETE",
        ];
        const currentIdx = TURNOVER_ORDER.indexOf(activeTurnover.status);
        const targetIdx = TURNOVER_ORDER.indexOf(expectedTurnoverStatus);
        if (targetIdx > currentIdx) {
          await tx.turnoverWorkflow.update({
            where: { id: activeTurnover.id },
            data: {
              status: expectedTurnoverStatus,
              ...(expectedTurnoverStatus === "COMPLETE" ? { completedAt: new Date(), isActive: false } : {}),
            },
          });
          changes.push(`TurnoverWorkflow.status: ${activeTurnover.status} → ${expectedTurnoverStatus}`);
        }
      } else if (!activeTurnover && expectedTurnoverStatus) {
        // Create turnover if unit is in a turnover-relevant status
        await tx.turnoverWorkflow.create({
          data: {
            unitId,
            buildingId: unit.buildingId,
            triggeredBy: "AUTO",
            status: expectedTurnoverStatus,
            ...(expectedTurnoverStatus === "COMPLETE" ? { completedAt: new Date(), isActive: false } : { isActive: true }),
          },
        });
        changes.push(`TurnoverWorkflow: created (status=${expectedTurnoverStatus})`);
      }
    } else if (shouldBeOccupied && activeTurnover) {
      await tx.turnoverWorkflow.update({
        where: { id: activeTurnover.id },
        data: { isActive: false, completedAt: new Date(), status: "COMPLETE" },
      });
      changes.push("TurnoverWorkflow: completed + deactivated");
    }

    return {
      unitId,
      vacancyStatus: status,
      isVacant: shouldBeVacant,
      hadDrift: changes.length > 0,
      changes,
    };
  });
}
