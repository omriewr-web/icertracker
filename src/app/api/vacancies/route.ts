import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getBuildingScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { getDisplayAddress } from "@/lib/building-matching";
import { toNumber } from "@/lib/utils/decimal";
import { VacancyStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const status = url.searchParams.get("status") as VacancyStatus | null;
  const daysVacant = url.searchParams.get("daysVacant"); // 30 | 60 | 90 | 90plus

  const scope = getBuildingScope(user, buildingId);
  if (scope === EMPTY_SCOPE) return NextResponse.json([]);

  const where: any = {
    ...(scope as object),
    isResidential: true,
    OR: [
      { isVacant: true },
      { vacancyStatus: { notIn: ["OCCUPIED"] } },
    ],
  };

  if (status) {
    where.vacancyStatus = status;
    // Remove the OR clause when filtering by specific status
    delete where.OR;
  }

  const now = new Date();

  const units = await prisma.unit.findMany({
    where,
    include: {
      building: { select: { id: true, address: true, altAddress: true } },
      turnoverWorkflows: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          assignedToUserId: true,
          estimatedCost: true,
          inspectionDate: true,
          scopeOfWork: true,
          moveOutDate: true,
          createdAt: true,
          assignedTo: { select: { id: true, name: true } },
          vendorAssignments: { select: { id: true } },
        },
      },
    },
    orderBy: [{ building: { address: "asc" } }, { unitNumber: "asc" }],
  });

  const result = units.map((u) => {
    const turnover = u.turnoverWorkflows[0] ?? null;
    const vacantSinceDate = u.vacantSince ?? turnover?.moveOutDate ?? null;
    const daysVacantNum = vacantSinceDate
      ? Math.max(0, Math.floor((now.getTime() - new Date(vacantSinceDate).getTime()) / 86400000))
      : null;
    const daysSinceReady = u.readyDate
      ? Math.max(0, Math.floor((now.getTime() - new Date(u.readyDate).getTime()) / 86400000))
      : null;

    const approved = toNumber(u.approvedRent);
    const proposed = toNumber(u.proposedRent);
    const asking = toNumber(u.askingRent);
    const legal = toNumber(u.legalRent);
    const bestRent = approved || proposed || asking || legal || 0;

    // Null safety: unit with active turnover but null vacancyStatus → treat as TURNOVER
    const effectiveStatus = u.vacancyStatus ?? (turnover ? "TURNOVER" : "VACANT");

    return {
      id: u.id,
      unitNumber: u.unitNumber,
      buildingId: u.building.id,
      buildingAddress: getDisplayAddress(u.building),
      bedroomCount: u.bedroomCount,
      bathroomCount: u.bathroomCount != null ? toNumber(u.bathroomCount) : null,
      squareFeet: u.squareFeet,
      legalRent: legal || null,
      askingRent: asking || null,
      proposedRent: proposed || null,
      approvedRent: approved || null,
      rentProposedBy: u.rentProposedBy,
      rentApprovedBy: u.rentApprovedBy,
      rentProposedAt: u.rentProposedAt?.toISOString() ?? null,
      rentApprovedAt: u.rentApprovedAt?.toISOString() ?? null,
      vacancyStatus: effectiveStatus,
      vacantSince: vacantSinceDate?.toISOString() ?? null,
      readyDate: u.readyDate?.toISOString() ?? null,
      statusChangedAt: u.statusChangedAt?.toISOString() ?? null,
      accessType: u.accessType,
      accessNotes: u.accessNotes,
      superName: u.superName,
      superPhone: u.superPhone,
      isVacant: u.isVacant,
      daysVacant: daysVacantNum,
      daysSinceReady: daysSinceReady,
      bestRent,
      turnover: turnover
        ? {
            id: turnover.id,
            status: turnover.status,
            assignedToId: turnover.assignedToUserId,
            assignedToName: turnover.assignedTo?.name ?? null,
            estimatedCost: toNumber(turnover.estimatedCost) || null,
            inspectionDate: turnover.inspectionDate?.toISOString() ?? null,
            scopeOfWork: turnover.scopeOfWork,
            moveOutDate: turnover.moveOutDate?.toISOString() ?? null,
            vendorCount: turnover.vendorAssignments.length,
          }
        : null,
    };
  });

  // Apply daysVacant filter client-side (after computed field)
  let filtered = result;
  if (daysVacant === "30") filtered = result.filter((u) => u.daysVacant !== null && u.daysVacant <= 30);
  else if (daysVacant === "60") filtered = result.filter((u) => u.daysVacant !== null && u.daysVacant > 30 && u.daysVacant <= 60);
  else if (daysVacant === "90") filtered = result.filter((u) => u.daysVacant !== null && u.daysVacant > 60 && u.daysVacant <= 90);
  else if (daysVacant === "90plus") filtered = result.filter((u) => u.daysVacant !== null && u.daysVacant > 90);

  return NextResponse.json(filtered);
}, "vac");
