/**
 * Centralized data scoping for authorization.
 *
 * DEFAULT DENY: non-admin users with no assigned properties see NOTHING.
 * Admin-level roles see all buildings within their org.
 * SUPER_ADMIN sees everything across all orgs.
 * Non-admin with assignments see only their buildings.
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
 * All other roles get { organizationId: user.organizationId }.
 */
export function getOrgScope(user: ScopeUser): Record<string, unknown> {
  if (user.role === "SUPER_ADMIN") return {};
  // If org is not set, admin roles see all; non-admin with no org see nothing
  if (!user.organizationId) {
    if (FULL_ORG_ROLES.includes(user.role)) return {};
    return { organizationId: "__no_org__" }; // will match nothing
  }
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
  if (explicitBuildingId) {
    if (user.role === "SUPER_ADMIN") {
      return { buildingId: { in: [explicitBuildingId] } };
    }
    if (FULL_ORG_ROLES.includes(user.role)) {
      // If org is null, skip org filter for admin roles (defense-in-depth only when org exists)
      if (!user.organizationId) return { buildingId: { in: [explicitBuildingId] } };
      return { buildingId: { in: [explicitBuildingId] }, building: { organizationId: user.organizationId } };
    }
    const assigned = user.assignedProperties ?? [];
    if (assigned.length === 0 || !assigned.includes(explicitBuildingId)) {
      return EMPTY_SCOPE;
    }
    if (!user.organizationId) return { buildingId: { in: [explicitBuildingId] } };
    return { buildingId: { in: [explicitBuildingId] }, building: { organizationId: user.organizationId } };
  }

  if (user.role === "SUPER_ADMIN") return {};
  if (FULL_ORG_ROLES.includes(user.role)) {
    if (!user.organizationId) return {};
    return { building: { organizationId: user.organizationId } };
  }

  const assigned = user.assignedProperties ?? [];
  if (assigned.length === 0) return EMPTY_SCOPE;

  if (!user.organizationId) return { buildingId: { in: assigned } };
  return { buildingId: { in: assigned }, building: { organizationId: user.organizationId } };
}

/**
 * Same as getBuildingScope but for the buildings table itself (uses `id` not `buildingId`).
 * ADMIN/ACCOUNT_ADMIN: restricted to their organization.
 */
export function getBuildingIdScope(user: ScopeUser, explicitBuildingId?: string | null) {
  if (explicitBuildingId) {
    if (user.role === "SUPER_ADMIN") {
      return { id: explicitBuildingId };
    }
    if (FULL_ORG_ROLES.includes(user.role)) {
      if (!user.organizationId) return { id: explicitBuildingId };
      return { id: explicitBuildingId, organizationId: user.organizationId };
    }
    const assigned = user.assignedProperties ?? [];
    if (assigned.length === 0 || !assigned.includes(explicitBuildingId)) {
      return EMPTY_SCOPE;
    }
    if (!user.organizationId) return { id: explicitBuildingId };
    return { id: explicitBuildingId, organizationId: user.organizationId };
  }

  if (user.role === "SUPER_ADMIN") return {};
  if (FULL_ORG_ROLES.includes(user.role)) {
    if (!user.organizationId) return {};
    return { organizationId: user.organizationId };
  }

  const assigned = user.assignedProperties ?? [];
  if (assigned.length === 0) return EMPTY_SCOPE;

  if (!user.organizationId) return { id: { in: assigned } };
  return { id: { in: assigned }, organizationId: user.organizationId };
}

/**
 * Returns a Prisma where clause for tenant queries (scoped through unit → building).
 * ADMIN/ACCOUNT_ADMIN: restricted to their organization's buildings.
 */
export function getTenantScope(user: ScopeUser, explicitBuildingId?: string | null) {
  if (explicitBuildingId) {
    if (user.role === "SUPER_ADMIN") {
      return { unit: { buildingId: explicitBuildingId } };
    }
    if (FULL_ORG_ROLES.includes(user.role)) {
      if (!user.organizationId) return { unit: { buildingId: explicitBuildingId } };
      return { unit: { buildingId: explicitBuildingId, building: { organizationId: user.organizationId } } };
    }
    const assigned = user.assignedProperties ?? [];
    if (assigned.length === 0 || !assigned.includes(explicitBuildingId)) {
      return EMPTY_SCOPE;
    }
    if (!user.organizationId) return { unit: { buildingId: explicitBuildingId } };
    return { unit: { buildingId: explicitBuildingId, building: { organizationId: user.organizationId } } };
  }

  if (user.role === "SUPER_ADMIN") return {};
  if (FULL_ORG_ROLES.includes(user.role)) {
    if (!user.organizationId) return {};
    return { unit: { building: { organizationId: user.organizationId } } };
  }

  const assigned = user.assignedProperties ?? [];
  if (assigned.length === 0) return EMPTY_SCOPE;

  if (!user.organizationId) return { unit: { buildingId: { in: assigned } } };
  return { unit: { buildingId: { in: assigned }, building: { organizationId: user.organizationId } } };
}

/**
 * Returns a Prisma where clause for Lease queries (scoped through buildingId).
 * Leases have a direct buildingId FK, so scoping is simpler than tenants.
 */
export function getLeaseScope(user: ScopeUser, explicitBuildingId?: string | null): ScopeResult {
  if (explicitBuildingId) {
    if (user.role === "SUPER_ADMIN") {
      return { buildingId: explicitBuildingId };
    }
    if (FULL_ORG_ROLES.includes(user.role)) {
      if (!user.organizationId) return { buildingId: explicitBuildingId };
      return { buildingId: explicitBuildingId, organizationId: user.organizationId };
    }
    const assigned = user.assignedProperties ?? [];
    if (assigned.length === 0 || !assigned.includes(explicitBuildingId)) {
      return EMPTY_SCOPE;
    }
    if (!user.organizationId) return { buildingId: explicitBuildingId };
    return { buildingId: explicitBuildingId, organizationId: user.organizationId };
  }

  if (user.role === "SUPER_ADMIN") return {};
  if (FULL_ORG_ROLES.includes(user.role)) {
    if (!user.organizationId) return {};
    return { organizationId: user.organizationId };
  }

  const assigned = user.assignedProperties ?? [];
  if (assigned.length === 0) return EMPTY_SCOPE;

  if (!user.organizationId) return { buildingId: { in: assigned } };
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

const FORBIDDEN = NextResponse.json({ error: "Forbidden" }, { status: 403 });

/** Verify the user can access a tenant by looking up its building. Returns 403 response or null. */
export async function assertTenantAccess(user: ScopeUser, tenantId: string): Promise<NextResponse | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { unit: { select: { buildingId: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, tenant.unit.buildingId))) return FORBIDDEN;
  return null;
}

/** Verify the user can access a building. Returns 403/404 response or null. */
export async function assertBuildingAccess(user: ScopeUser, buildingId: string): Promise<NextResponse | null> {
  if (await canAccessBuilding(user, buildingId)) return null;
  return FORBIDDEN;
}

/** Verify the user can access a work order by looking up its building. Returns 403/404 response or null. */
export async function assertWorkOrderAccess(user: ScopeUser, workOrderId: string): Promise<NextResponse | null> {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { buildingId: true },
  });
  if (!wo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, wo.buildingId))) return FORBIDDEN;
  return null;
}

/** Verify the user can access a unit by looking up its building. Returns 403/404 response or null. */
export async function assertUnitAccess(user: ScopeUser, unitId: string): Promise<NextResponse | null> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { buildingId: true },
  });
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, unit.buildingId))) return FORBIDDEN;
  return null;
}

/** Verify the user can access a compliance item by looking up its building. Returns 403/404 response or null. */
export async function assertComplianceAccess(user: ScopeUser, itemId: string): Promise<NextResponse | null> {
  const item = await prisma.complianceItem.findUnique({
    where: { id: itemId },
    select: { buildingId: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessBuilding(user, item.buildingId))) return FORBIDDEN;
  return null;
}
