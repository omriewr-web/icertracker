import type { UserRole } from "@/types";
import { prisma } from "./prisma";
import { ApiRequestError } from "./request-errors";

export interface WorkOrderRelationInput {
  buildingId: string;
  unitId?: string | null;
  tenantId?: string | null;
  vendorId?: string | null;
  assignedToId?: string | null;
}

async function loadBuildingOrgId(buildingId: string): Promise<string | null> {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { organizationId: true },
  });

  if (!building) {
    throw new ApiRequestError("Building not found", 404);
  }

  return building.organizationId ?? null;
}

export async function assertUnitBelongsToBuilding(buildingId: string, unitId: string): Promise<void> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { buildingId: true },
  });

  if (!unit) {
    throw new ApiRequestError("Unit not found", 404);
  }

  if (unit.buildingId !== buildingId) {
    throw new ApiRequestError("Unit does not belong to the selected building", 400);
  }
}

export async function validateWorkOrderRelations(input: WorkOrderRelationInput): Promise<void> {
  const buildingOrgId = await loadBuildingOrgId(input.buildingId);

  const [tenant, vendor, assignedTo] = await Promise.all([
    input.tenantId
      ? prisma.tenant.findUnique({
          where: { id: input.tenantId },
          select: { unitId: true, unit: { select: { buildingId: true } } },
        })
      : Promise.resolve(null),
    input.vendorId
      ? prisma.vendor.findUnique({
          where: { id: input.vendorId },
          select: { organizationId: true },
        })
      : Promise.resolve(null),
    input.assignedToId
      ? prisma.user.findUnique({
          where: { id: input.assignedToId },
          select: { active: true, organizationId: true, role: true },
        })
      : Promise.resolve(null),
  ]);

  if (input.unitId) {
    await assertUnitBelongsToBuilding(input.buildingId, input.unitId);
  }

  if (input.tenantId) {
    if (!tenant) {
      throw new ApiRequestError("Tenant not found", 404);
    }

    if (tenant.unit.buildingId !== input.buildingId) {
      throw new ApiRequestError("Tenant does not belong to the selected building", 400);
    }

    if (input.unitId && tenant.unitId !== input.unitId) {
      throw new ApiRequestError("Tenant does not belong to the selected unit", 400);
    }
  }

  if (input.vendorId) {
    if (!vendor) {
      throw new ApiRequestError("Vendor not found", 404);
    }

    if (buildingOrgId && vendor.organizationId && vendor.organizationId !== buildingOrgId) {
      throw new ApiRequestError("Vendor does not belong to the selected organization", 400);
    }
  }

  if (input.assignedToId) {
    if (!assignedTo) {
      throw new ApiRequestError("Assigned user not found", 404);
    }

    if (!assignedTo.active) {
      throw new ApiRequestError("Assigned user must be active", 400);
    }

    const assignedRole = assignedTo.role as UserRole;
    if (
      buildingOrgId &&
      assignedRole !== "SUPER_ADMIN" &&
      assignedTo.organizationId !== buildingOrgId
    ) {
      throw new ApiRequestError("Assigned user does not belong to the selected organization", 400);
    }
  }
}

export async function assertLinkedWorkOrderMatchesBuilding(
  workOrderId: string,
  buildingId: string
): Promise<void> {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { buildingId: true },
  });

  if (!workOrder) {
    throw new ApiRequestError("Work order not found", 404);
  }

  if (workOrder.buildingId !== buildingId) {
    throw new ApiRequestError("Work order belongs to a different building", 400);
  }
}

export async function assertLinkedViolationMatchesBuilding(
  violationId: string,
  buildingId: string
): Promise<void> {
  const violation = await prisma.violation.findUnique({
    where: { id: violationId },
    select: { buildingId: true },
  });

  if (!violation) {
    throw new ApiRequestError("Violation not found", 404);
  }

  if (violation.buildingId !== buildingId) {
    throw new ApiRequestError("Violation belongs to a different building", 400);
  }
}
