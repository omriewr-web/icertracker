import { prisma } from "@/lib/prisma";
import { getBuildingScope, getBuildingIdScope, EMPTY_SCOPE } from "@/lib/data-scope";
import { TurnoverStatus } from "@prisma/client";

interface ScopeUser {
  role: string;
  assignedProperties?: string[] | null;
  organizationId?: string | null;
}

// ── Status ordering ──────────────────────────────────────────

const STATUS_ORDER: TurnoverStatus[] = [
  "PENDING_INSPECTION",
  "INSPECTION_DONE",
  "SCOPE_CREATED",
  "VENDORS_ASSIGNED",
  "READY_TO_LIST",
  "LISTED",
  "COMPLETE",
];

export function getStatusIndex(status: TurnoverStatus): number {
  return STATUS_ORDER.indexOf(status);
}

export function isValidTransition(current: TurnoverStatus, next: TurnoverStatus): boolean {
  const ci = getStatusIndex(current);
  const ni = getStatusIndex(next);
  return ni > ci;
}

// ── List turnovers ───────────────────────────────────────────

export async function listTurnovers(user: ScopeUser, filters?: { status?: string; buildingId?: string }) {
  const scope = getBuildingScope(user, filters?.buildingId);
  if (scope === EMPTY_SCOPE) return [];

  const where: any = { ...(scope as object), isActive: true };
  if (filters?.status) where.status = filters.status;

  return prisma.turnoverWorkflow.findMany({
    where,
    include: {
      unit: { select: { unitNumber: true } },
      building: { select: { address: true } },
      assignedTo: { select: { id: true, name: true } },
      vendorAssignments: { select: { id: true, trade: true, vendorName: true, status: true, cost: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── Get single turnover ──────────────────────────────────────

export async function getTurnover(id: string) {
  return prisma.turnoverWorkflow.findUnique({
    where: { id },
    include: {
      unit: { select: { unitNumber: true, buildingId: true } },
      building: { select: { address: true } },
      assignedTo: { select: { id: true, name: true } },
      vendorAssignments: {
        include: { vendor: { select: { id: true, name: true, company: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

// ── Create turnover ──────────────────────────────────────────

export async function createTurnover(data: {
  unitId: string;
  buildingId: string;
  triggeredBy?: "MANUAL" | "AUTO";
  moveOutDate?: string | null;
  moveOutSource?: string | null;
  assignedToUserId?: string | null;
}) {
  // Check for existing active turnover on this unit
  const existing = await prisma.turnoverWorkflow.findFirst({
    where: { unitId: data.unitId, isActive: true },
  });
  if (existing) return existing;

  const moveOutDateParsed = data.moveOutDate ? new Date(data.moveOutDate) : null;

  // Create turnover and set vacantSince on the unit if not already set
  return prisma.$transaction(async (tx) => {
    const turnover = await tx.turnoverWorkflow.create({
      data: {
        unitId: data.unitId,
        buildingId: data.buildingId,
        triggeredBy: data.triggeredBy || "MANUAL",
        moveOutDate: moveOutDateParsed,
        moveOutSource: data.moveOutSource || null,
        assignedToUserId: data.assignedToUserId || null,
        status: "PENDING_INSPECTION",
      },
    });

    // Auto-set vacantSince from moveOutDate or now if not already set
    const unit = await tx.unit.findUnique({
      where: { id: data.unitId },
      select: { vacantSince: true },
    });
    if (unit && !unit.vacantSince) {
      await tx.unit.update({
        where: { id: data.unitId },
        data: { vacantSince: moveOutDateParsed || new Date() },
      });
    }

    return turnover;
  });
}

// ── Update turnover ──────────────────────────────────────────

export async function updateTurnover(id: string, data: {
  status?: TurnoverStatus;
  inspectionDate?: string | null;
  inspectionNotes?: string | null;
  inspectionChecklist?: any;
  scopeOfWork?: string | null;
  estimatedCost?: number | null;
  listedDate?: string | null;
  assignedToUserId?: string | null;
}) {
  const updateData: any = {};

  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "COMPLETE") updateData.completedAt = new Date();
  }
  if (data.inspectionDate !== undefined) updateData.inspectionDate = data.inspectionDate ? new Date(data.inspectionDate) : null;
  if (data.inspectionNotes !== undefined) updateData.inspectionNotes = data.inspectionNotes;
  if (data.inspectionChecklist !== undefined) updateData.inspectionChecklist = data.inspectionChecklist;
  if (data.scopeOfWork !== undefined) updateData.scopeOfWork = data.scopeOfWork;
  if (data.estimatedCost !== undefined) updateData.estimatedCost = data.estimatedCost;
  if (data.listedDate !== undefined) updateData.listedDate = data.listedDate ? new Date(data.listedDate) : null;
  if (data.assignedToUserId !== undefined) updateData.assignedToUserId = data.assignedToUserId || null;

  return prisma.turnoverWorkflow.update({ where: { id }, data: updateData });
}

// ── Auto-create turnover when unit becomes vacant ────────────

export async function autoCreateTurnoverForVacancy(unitId: string, buildingId: string) {
  const existing = await prisma.turnoverWorkflow.findFirst({
    where: { unitId, isActive: true },
  });
  if (existing) return null;

  return prisma.turnoverWorkflow.create({
    data: {
      unitId,
      buildingId,
      triggeredBy: "AUTO",
      status: "PENDING_INSPECTION",
    },
  });
}

// ── Vendor assignments ───────────────────────────────────────

export async function addVendorAssignment(turnoverWorkflowId: string, data: {
  vendorId?: string | null;
  vendorName: string;
  trade: string;
  scheduledDate?: string | null;
  cost?: number | null;
  notes?: string | null;
}) {
  return prisma.turnoverVendorAssignment.create({
    data: {
      turnoverWorkflowId,
      vendorId: data.vendorId || null,
      vendorName: data.vendorName,
      trade: data.trade,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
      cost: data.cost || null,
      notes: data.notes || null,
    },
  });
}

export async function updateVendorAssignment(id: string, data: {
  status?: "PENDING" | "SCHEDULED" | "COMPLETED";
  scheduledDate?: string | null;
  completedDate?: string | null;
  cost?: number | null;
  notes?: string | null;
}) {
  const updateData: any = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.scheduledDate !== undefined) updateData.scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : null;
  if (data.completedDate !== undefined) updateData.completedDate = data.completedDate ? new Date(data.completedDate) : null;
  if (data.cost !== undefined) updateData.cost = data.cost;
  if (data.notes !== undefined) updateData.notes = data.notes;

  return prisma.turnoverVendorAssignment.update({ where: { id }, data: updateData });
}
