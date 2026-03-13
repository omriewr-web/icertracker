/**
 * Lease resolution helpers.
 * These respect the existing org/building scoping patterns from data-scope.ts.
 */
import { prisma } from "@/lib/prisma";

interface ScopeUser {
  role: string;
  assignedProperties?: string[] | null;
  organizationId?: string | null;
}

const FULL_ORG_ROLES = ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN"];

/**
 * Build a scoping filter for lease queries based on user role.
 * Mirrors the patterns in data-scope.ts but for the Lease model directly.
 */
function getLeaseOrgFilter(user: ScopeUser): Record<string, unknown> {
  if (user.role === "SUPER_ADMIN") return {};
  if (FULL_ORG_ROLES.includes(user.role)) {
    return { organizationId: user.organizationId };
  }
  const assigned = user.assignedProperties ?? [];
  if (assigned.length === 0) return { id: "__NO_ACCESS__" }; // impossible match
  return { buildingId: { in: assigned } };
}

/**
 * Get the current active lease for a tenant.
 * Returns the lease marked isCurrent=true, or the most recent one.
 */
export async function getCurrentLeaseForTenant(
  tenantId: string,
  user?: ScopeUser,
) {
  const where: Record<string, unknown> = {
    tenantId,
    isCurrent: true,
    ...(user ? getLeaseOrgFilter(user) : {}),
  };

  return prisma.lease.findFirst({
    where,
    include: {
      unit: { select: { id: true, unitNumber: true, buildingId: true } },
      recurringCharges: { where: { active: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get the current active lease for a unit.
 * Returns the lease marked isCurrent=true, or null if unit is vacant.
 */
export async function getCurrentLeaseForUnit(
  unitId: string,
  user?: ScopeUser,
) {
  const where: Record<string, unknown> = {
    unitId,
    isCurrent: true,
    ...(user ? getLeaseOrgFilter(user) : {}),
  };

  return prisma.lease.findFirst({
    where,
    include: {
      tenant: { select: { id: true, name: true, email: true, phone: true } },
      recurringCharges: { where: { active: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get all leases for a unit, ordered by creation date descending (most recent first).
 */
export async function getLeaseHistoryForUnit(
  unitId: string,
  user?: ScopeUser,
) {
  const where: Record<string, unknown> = {
    unitId,
    ...(user ? getLeaseOrgFilter(user) : {}),
  };

  return prisma.lease.findMany({
    where,
    include: {
      tenant: { select: { id: true, name: true } },
      balanceSnapshots: { orderBy: { snapshotDate: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get all leases for a tenant, ordered by creation date descending.
 */
export async function getLeaseHistoryForTenant(
  tenantId: string,
  user?: ScopeUser,
) {
  const where: Record<string, unknown> = {
    tenantId,
    ...(user ? getLeaseOrgFilter(user) : {}),
  };

  return prisma.lease.findMany({
    where,
    include: {
      unit: {
        select: {
          id: true,
          unitNumber: true,
          building: { select: { id: true, address: true } },
        },
      },
      balanceSnapshots: { orderBy: { snapshotDate: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * End a lease (mark as no longer current) when a tenant is deleted or moves out.
 * Uses the deterministic ID pattern: `{tenantId}-lease`.
 */
export async function endCurrentLease(tenantId: string) {
  const leaseId = `${tenantId}-lease`;
  const existing = await prisma.lease.findUnique({ where: { id: leaseId } });
  if (!existing) return null;

  return prisma.lease.update({
    where: { id: leaseId },
    data: {
      isCurrent: false,
      status: "TERMINATED",
      moveOutDate: new Date(),
    },
  });
}
