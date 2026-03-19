// ── Permission system v2 — engine ───────────────────────────

import { prisma } from "@/lib/prisma";
import type { UserAccessGrant } from "@prisma/client";
import type { Module, PermissionLevel, ScopeType, ModulePermissions, PermissionPreset } from "./types";
import { LEVEL_RANK, MODULES } from "./types";
import { PERMISSION_PRESETS } from "./presets";

// ── Core permission check ───────────────────────────────────

/**
 * Get the effective permission level for a user on a given module.
 * Checks grants from most specific scope (building) to least (org).
 */
export function getEffectiveLevel(
  grants: Pick<UserAccessGrant, "module" | "level" | "scopeType" | "scopeId">[],
  module: Module,
  scopeType: ScopeType = "org",
  scopeId?: string
): PermissionLevel {
  const moduleGrants = grants.filter((g) => g.module === module);
  if (moduleGrants.length === 0) return "none";

  // If a specific scope was requested, look for the most specific match first
  if (scopeId && scopeType !== "org") {
    const specific = moduleGrants.find(
      (g) => g.scopeType === scopeType && g.scopeId === scopeId
    );
    if (specific) return specific.level as PermissionLevel;
  }

  // Fall back to org-level grant (broadest scope)
  const orgGrant = moduleGrants.find((g) => g.scopeType === "org");
  if (orgGrant) return orgGrant.level as PermissionLevel;

  // Return highest level found across all grants for this module
  let highest: PermissionLevel = "none";
  for (const g of moduleGrants) {
    const level = g.level as PermissionLevel;
    if (LEVEL_RANK[level] > LEVEL_RANK[highest]) {
      highest = level;
    }
  }
  return highest;
}

// ── User-facing permission check ────────────────────────────

interface PermissionUser {
  permissionPreset: string;
  canExportSensitive: boolean;
  canDeleteRecords: boolean;
  canBulkUpdate: boolean;
  canManageUsers: boolean;
  canManageOrgSettings: boolean;
  accessGrants: Pick<UserAccessGrant, "module" | "level" | "scopeType" | "scopeId">[];
}

/**
 * Check if a user can perform an action.
 *
 * Action format: "module.level" e.g. "collections.edit"
 * Special actions: "*.exportSensitive", "*.deleteRecords", "*.bulkUpdate",
 *                  "*.manageUsers", "*.manageSettings"
 */
export function can(
  user: PermissionUser,
  action: string,
  resource?: { scopeType?: ScopeType; scopeId?: string }
): boolean {
  // Handle special dangerous-privilege actions
  if (action.startsWith("*.")) {
    const privilege = action.slice(2);
    switch (privilege) {
      case "exportSensitive": return user.canExportSensitive;
      case "deleteRecords": return user.canDeleteRecords;
      case "bulkUpdate": return user.canBulkUpdate;
      case "manageUsers": return user.canManageUsers;
      case "manageSettings": return user.canManageOrgSettings;
      default: return false;
    }
  }

  // Parse "module.level" action format
  const dotIndex = action.indexOf(".");
  if (dotIndex === -1) return false;

  const module = action.slice(0, dotIndex) as Module;
  const requiredLevel = action.slice(dotIndex + 1) as PermissionLevel;

  if (!(module in LEVEL_RANK) && !MODULES.includes(module)) return false;
  if (!(requiredLevel in LEVEL_RANK)) return false;

  const effective = getEffectiveLevel(
    user.accessGrants,
    module,
    resource?.scopeType,
    resource?.scopeId
  );

  return LEVEL_RANK[effective] >= LEVEL_RANK[requiredLevel];
}

// ── Grant management ────────────────────────────────────────

/**
 * Create or update access grants for a user based on a preset.
 * Uses a Prisma transaction to upsert one grant per module.
 */
export async function createGrantsFromPreset(
  userId: string,
  orgId: string,
  preset: PermissionPreset,
  overrides?: Partial<ModulePermissions>
): Promise<void> {
  const base = PERMISSION_PRESETS[preset];
  if (!base) throw new Error(`Unknown permission preset: ${preset}`);

  const merged: ModulePermissions = { ...base, ...overrides };

  await prisma.$transaction(
    MODULES.map((module) =>
      prisma.userAccessGrant.upsert({
        where: {
          userId_orgId_module_scopeType_scopeId: {
            userId,
            orgId,
            module,
            scopeType: "org",
            scopeId: orgId,
          },
        },
        create: {
          userId,
          orgId,
          module,
          level: merged[module],
          scopeType: "org",
          scopeId: orgId,
        },
        update: {
          level: merged[module],
        },
      })
    )
  );
}

// ── User query helper ───────────────────────────────────────

export interface UserWithGrants {
  id: string;
  role: string;
  permissionPreset: string;
  canExportSensitive: boolean;
  canDeleteRecords: boolean;
  canBulkUpdate: boolean;
  canManageUsers: boolean;
  canManageOrgSettings: boolean;
  organizationId: string | null;
  accessGrants: Pick<UserAccessGrant, "id" | "module" | "level" | "scopeType" | "scopeId" | "orgId">[];
}

/**
 * Load a user with all their access grants in one query.
 */
export async function getUserWithGrants(userId: string): Promise<UserWithGrants | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      permissionPreset: true,
      canExportSensitive: true,
      canDeleteRecords: true,
      canBulkUpdate: true,
      canManageUsers: true,
      canManageOrgSettings: true,
      organizationId: true,
      accessGrants: {
        select: {
          id: true,
          module: true,
          level: true,
          scopeType: true,
          scopeId: true,
          orgId: true,
        },
      },
    },
  });
}
