/**
 * Centralized data scoping for authorization.
 *
 * DEFAULT DENY: non-admin users with no assigned properties see NOTHING.
 * Admin users see everything. Non-admin with assignments see only their buildings.
 */

import { NextResponse } from "next/server";
import { prisma } from "./prisma";

interface ScopeUser {
  role: string;
  assignedProperties?: string[] | null;
}

/** Sentinel value: when returned, the route should return an empty result set. */
export const EMPTY_SCOPE = Symbol("EMPTY_SCOPE");

type ScopeResult = { buildingId: { in: string[] } } | Record<string, never> | typeof EMPTY_SCOPE;

/**
 * Returns a Prisma where clause fragment for building-level queries.
 *
 * Usage: `const where = getBuildingScope(user); if (where === EMPTY_SCOPE) return [];`
 * Then spread `where` into your Prisma where clause for the buildingId field.
 */
export function getBuildingScope(user: ScopeUser, explicitBuildingId?: string | null): ScopeResult {
  if (explicitBuildingId) {
    // Even with an explicit ID, non-admin users must own it
    if (user.role === "ADMIN") {
      return { buildingId: { in: [explicitBuildingId] } };
    }
    const assigned = user.assignedProperties ?? [];
    if (assigned.length === 0 || !assigned.includes(explicitBuildingId)) {
      return EMPTY_SCOPE;
    }
    return { buildingId: { in: [explicitBuildingId] } };
  }

  if (user.role === "ADMIN") return {};

  const assigned = user.assignedProperties ?? [];
  if (assigned.length === 0) return EMPTY_SCOPE;

  return { buildingId: { in: assigned } };
}

/**
 * Same as getBuildingScope but for the buildings table itself (uses `id` not `buildingId`).
 */
export function getBuildingIdScope(user: ScopeUser, explicitBuildingId?: string | null) {
  if (explicitBuildingId) {
    if (user.role === "ADMIN") {
      return { id: explicitBuildingId };
    }
    const assigned = user.assignedProperties ?? [];
    if (assigned.length === 0 || !assigned.includes(explicitBuildingId)) {
      return EMPTY_SCOPE;
    }
    return { id: explicitBuildingId };
  }

  if (user.role === "ADMIN") return {};

  const assigned = user.assignedProperties ?? [];
  if (assigned.length === 0) return EMPTY_SCOPE;

  return { id: { in: assigned } };
}

/**
 * Returns a Prisma where clause for tenant queries (scoped through unit → building).
 */
export function getTenantScope(user: ScopeUser, explicitBuildingId?: string | null) {
  if (explicitBuildingId) {
    if (user.role === "ADMIN") {
      return { unit: { buildingId: explicitBuildingId } };
    }
    const assigned = user.assignedProperties ?? [];
    if (assigned.length === 0 || !assigned.includes(explicitBuildingId)) {
      return EMPTY_SCOPE;
    }
    return { unit: { buildingId: explicitBuildingId } };
  }

  if (user.role === "ADMIN") return {};

  const assigned = user.assignedProperties ?? [];
  if (assigned.length === 0) return EMPTY_SCOPE;

  return { unit: { buildingId: { in: assigned } } };
}

// ── Ownership verification helpers for detail routes ─────────────

/** Check if a user can access a specific building */
export function canAccessBuilding(user: ScopeUser, buildingId: string): boolean {
  if (user.role === "ADMIN") return true;
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
  if (!canAccessBuilding(user, tenant.unit.buildingId)) return FORBIDDEN;
  return null;
}

/** Verify the user can access a building. Returns 403/404 response or null. */
export async function assertBuildingAccess(user: ScopeUser, buildingId: string): Promise<NextResponse | null> {
  if (canAccessBuilding(user, buildingId)) return null;
  return FORBIDDEN;
}

/** Verify the user can access a work order by looking up its building. Returns 403/404 response or null. */
export async function assertWorkOrderAccess(user: ScopeUser, workOrderId: string): Promise<NextResponse | null> {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { buildingId: true },
  });
  if (!wo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessBuilding(user, wo.buildingId)) return FORBIDDEN;
  return null;
}

/** Verify the user can access a unit by looking up its building. Returns 403/404 response or null. */
export async function assertUnitAccess(user: ScopeUser, unitId: string): Promise<NextResponse | null> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { buildingId: true },
  });
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessBuilding(user, unit.buildingId)) return FORBIDDEN;
  return null;
}

/** Verify the user can access a compliance item by looking up its building. Returns 403/404 response or null. */
export async function assertComplianceAccess(user: ScopeUser, itemId: string): Promise<NextResponse | null> {
  const item = await prisma.complianceItem.findUnique({
    where: { id: itemId },
    select: { buildingId: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessBuilding(user, item.buildingId)) return FORBIDDEN;
  return null;
}
