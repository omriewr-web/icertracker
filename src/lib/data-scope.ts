/**
 * Centralized data scoping for authorization.
 *
 * DEFAULT DENY: every non-SUPER_ADMIN user MUST have an organizationId
 * or they see NOTHING (EMPTY_SCOPE). This is enforced as defense-in-depth
 * alongside withAuth()'s own org check.
 *
 * SUPER_ADMIN: sees everything across all orgs (no filter).
 * ADMIN/ACCOUNT_ADMIN: sees all buildings within their org.
 * Other roles: sees only their assigned buildings within their org.
 * Roles with managers (APM, LEASING_SPECIALIST, ACCOUNTING) inherit
 * their manager's buildings — resolved at login time in auth.ts.
 */

import { NextResponse } from "next/server";
import { prisma } from "./prisma";

interface ScopeUser {
  role: string;
  assignedProperties?: string[] | null;
  organizationId?: string | null;
}

// Roles that have full access to all buildings within their org
const FULL_ORG_ROLES = ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN"];

/** Sentinel value: when returned, the route should return an empty result set. */
export const EMPTY_SCOPE = Symbol("EMPTY_SCOPE");

type ScopeResult = Record<string, unknown> | typeof EMPTY_SCOPE;

/**
 * Returns an org-level Prisma where clause fragment.
 * SUPER_ADMIN gets no filter (sees all orgs).
 * All other roles MUST have an organizationId or they see nothing.
 */
export function getOrgScope(user: ScopeUser): Record<string, unknown> {
  if (user.role === "SUPER_ADMIN") return {};
  if (!user.organizationId) return { organizationId: "__no_org__" }; // matches nothing
  return { organizationId: user.organizationId };
}

/**
 * Returns a Prisma where clause fragment for building-level queries.
 * Models must have a `buildingId` field and a `building` relation.
 *
 * SUPER_ADMIN: no filter.
 * ADMIN/ACCOUNT_ADMIN: restricted to their organization's buildings.
 * Others: restricted to their assigned buildings.
 */
export function getBuildingScope(user: ScopeUser, explicitBuildingId?: string | null): ScopeResult {
  // Non-SUPER_ADMIN without org: deny everything
  if (user.role !== "SUPER_ADMIN" && !user.organizationId) return EMPTY_SCOPE;

  if (explicitBuildingId) {
    if (user.role === "SUPER_ADMIN") {
      return { buildingId: { in: [explicitBuildingId] } };
    }
    if (FULL_ORG_ROLES.includes(user.role)) {
      return { buildingId: { in: [explicitBuildingId] }, building: { organizationId: user.organizationId } };
    }
    const assigned = user.assignedProperties ?? [];
    if (assigned.length === 0 || !assigned.includes(explicitBuildingId)) {
      return EMPTY_SCOPE;
    }
    return { buildingId: { in: [explicitBuildingId] }, building: { organizationId: user.organizationId } };
  }

  if (user.role === "SUPER_ADMIN") return {};
  if (FULL_ORG_ROLES.includes(user.role)) {
    return { building: { organizationId: user.organizationId } };
  }

  const assigned = user.assignedProperties ?? [];
  if (assigned.length === 0) return EMPTY_SCOPE;

  return { buildingId: { in: assigned }, building: { organizationId: user.organizationId } };
}

/**
 * Same as getBuildingScope but for the buildings table itself (uses `id` not `buildingId`).
 * ADMIN/ACCOUNT_ADMIN: restricted to their organization.
 */
export function getBuildingIdScope(user: ScopeUser, explicitBuildingId?: string | null) {
  // Non-SUPER_ADMIN without org: deny everything
  if (user.role !== "SUPER_ADMIN" && !user.organizationId) return EMPTY_SCOPE;

  if (explicitBuildingId) {
    if (user.role === "SUPER_ADMIN") {
      return { id: explicitBuildingId };
    }
    if (FULL_ORG_ROLES.includes(user.role)) {
      return { id: explicitBuildingId, organizationId: user.organizationId };
    }
    const assigned = user.assignedProperties ?? [];
    if (assigned.length === 0 || !assigned.includes(explicitBuildingId)) {
      return EMPTY_SCOPE;
    }
    return { id: explicitBuildingId, organizationId: user.organizationId };
  }

  if (user.role === "SUPER_ADMIN") return {};
  if (FULL_ORG_ROLES.includes(user.role)) {
    return { organizationId: user.organizationId };
  }

  const assigned = user.assignedProperties ?? [];
  if (assigned.length === 0) return EMPTY_SCOPE;

  return { id: { in: assigned }, organizationId: user.organizationId };
}

/**
 * Returns a Prisma where clause for tenant queries (scoped through unit → building).
 * ADMIN/ACCOUNT_ADMIN: restricted to their organization's buildings.
 */
export function getTenantScope(user: ScopeUser, explicitBuildingId?: string | null) {
  // Non-SUPER_ADMIN without org: deny everything
  if (user.role !== "SUPER_ADMIN" && !user.organizationId) return EMPTY_SCOPE;

  if (explicitBuildingId) {
    if (user.role === "SUPER_ADMIN") {
      return { unit: { buildingId: explicitBuildingId } };
    }
    if (FULL_ORG_ROLES.includes(user.role)) {
      return { unit: { buildingId: explicitBuildingId, building: { organizationId: user.organizationId } } };
    }
    const assigned = user.assignedProperties ?? [];
    if (assigned.length === 0 || !assigned.includes(explicitBuildingId)) {
      return EMPTY_SCOPE;
    }
    return { unit: { buildingId: explicitBuildingId, building: { organizationId: user.organizationId } } };
  }

  if (user.role === "SUPER_ADMIN") return {};
  if (FULL_ORG_ROLES.includes(user.role)) {
    return { unit: { building: { organizationId: user.organizationId } } };
  }

  const assigned = user.assignedProperties ?? [];
  if (assigned.length === 0) return EMPTY_SCOPE;

  return { unit: { buildingId: { in: assigned }, building: { organizationId: user.organizationId } } };
}

/**
 * Returns a Prisma where clause for Lease queries (scoped through buildingId).
 * Leases have a direct buildingId FK, so scoping is simpler than tenants.
 */
export function getLeaseScope(user: ScopeUser, explicitBuildingId?: string | null): ScopeResult {
  // Non-SUPER_ADMIN without org: deny everything
  if (user.role !== "SUPER_ADMIN" && !user.organizationId) return EMPTY_SCOPE;

  if (explicitBuildingId) {
    if (user.role === "SUPER_ADMIN") {
      return { buildingId: explicitBuildingId };
    }
    if (FULL_ORG_ROLES.includes(user.role)) {
      return { buildingId: explicitBuildingId, organizationId: user.organizationId };
    }
    const assigned = user.assignedProperties ?? [];
    if (assigned.length === 0 || !assigned.includes(explicitBuildingId)) {
      return EMPTY_SCOPE;
    }
    return { buildingId: explicitBuildingId, organizationId: user.organizationId };
  }

  if (user.role === "SUPER_ADMIN") return {};
  if (FULL_ORG_ROLES.includes(user.role)) {
    return { organizationId: user.organizationId };
  }

  const assigned = user.assignedProperties ?? [];
  if (assigned.length === 0) return EMPTY_SCOPE;

  return { buildingId: { in: assigned }, organizationId: user.organizationId };
}

// ── Ownership verification helpers for detail routes ─────────────

/**
 * Check if a user can access a specific building.
 * SUPER_ADMIN: always true.
 * ADMIN/ACCOUNT_ADMIN: verifies building belongs to their org (requires DB lookup).
 * Others: checks assigned properties.
 */
export async function canAccessBuilding(user: ScopeUser, buildingId: string): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true;

  if (FULL_ORG_ROLES.includes(user.role)) {
    if (!user.organizationId) return false;
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { organizationId: true },
    });
    return !!building && building.organizationId === user.organizationId;
  }

  const assigned = user.assignedProperties ?? [];
  return assigned.includes(buildingId);
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/** Verify the user can access a tenant by looking up its building. Returns 403 response or null. */
export async function assertTenantAccess(user: ScopeUser, tenantId: string): Promise<NextResponse | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { unit: { select: { buildingId: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, tenant.unit.buildingId))) return forbidden();
  return null;
}

/** Verify the user can access a building. Returns 403/404 response or null. */
export async function assertBuildingAccess(user: ScopeUser, buildingId: string): Promise<NextResponse | null> {
  if (await canAccessBuilding(user, buildingId)) return null;
  return forbidden();
}

/** Verify the user can access a work order by looking up its building. Returns 403/404 response or null. */
export async function assertWorkOrderAccess(user: ScopeUser, workOrderId: string): Promise<NextResponse | null> {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { buildingId: true },
  });
  if (!wo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, wo.buildingId))) return forbidden();
  return null;
}

/** Verify the user can access a unit by looking up its building. Returns 403/404 response or null. */
export async function assertUnitAccess(user: ScopeUser, unitId: string): Promise<NextResponse | null> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { buildingId: true },
  });
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, unit.buildingId))) return forbidden();
  return null;
}

/** Verify the user can access a compliance item by looking up its building. Returns 403/404 response or null. */
export async function assertComplianceAccess(user: ScopeUser, itemId: string): Promise<NextResponse | null> {
  const item = await prisma.complianceItem.findUnique({
    where: { id: itemId },
    select: { buildingId: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, item.buildingId))) return forbidden();
  return null;
}
