import type { UserRole } from "@/types";
import { canCreateRole } from "./permissions";
import { getEffectiveLevel, type UserWithGrants } from "./permissions/engine";
import { PERMISSION_PRESETS, PRESET_DANGEROUS_DEFAULTS } from "./permissions/presets";
import {
  LEVEL_RANK,
  MODULES,
  type DangerousPrivileges,
  type Module,
  type ModulePermissions,
  type PermissionLevel,
  type PermissionPreset,
} from "./permissions/types";
import { ApiRequestError } from "./request-errors";

export const USER_ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN"];

export const PRESET_ROLE_MAP: Record<PermissionPreset, UserRole> = {
  property_manager: "PM",
  ar_clerk: "COLLECTOR",
  leasing_agent: "LEASING_AGENT",
  building_super: "SUPER",
  reporting_only: "ACCOUNTING",
  owner_investor: "OWNER",
  account_admin: "ACCOUNT_ADMIN",
};

type DangerousPrivilegeKey = keyof DangerousPrivileges;

const DANGEROUS_PRIVILEGE_LABELS: Record<DangerousPrivilegeKey, string> = {
  canExportSensitive: "export sensitive data",
  canDeleteRecords: "delete records",
  canBulkUpdate: "bulk update records",
  canManageUsers: "manage users",
  canManageOrgSettings: "manage org settings",
};

export function canAccessUserAdmin(role: UserRole): boolean {
  return USER_ADMIN_ROLES.includes(role);
}

export function canManageExistingUser(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === "SUPER_ADMIN") {
    return true;
  }

  if (actorRole === "ADMIN") {
    return !["SUPER_ADMIN", "ADMIN"].includes(targetRole);
  }

  if (actorRole === "ACCOUNT_ADMIN") {
    return !USER_ADMIN_ROLES.includes(targetRole);
  }

  return false;
}

export function assertUserAdminAccess(role: UserRole): void {
  if (!canAccessUserAdmin(role)) {
    throw new ApiRequestError("Forbidden", 403);
  }
}

export function assertManageExistingUser(actorRole: UserRole, targetRole: UserRole): void {
  if (!canManageExistingUser(actorRole, targetRole)) {
    throw new ApiRequestError("Forbidden", 403);
  }
}

export function assertCreatablePreset(actorRole: UserRole, preset: PermissionPreset): void {
  const targetRole = PRESET_ROLE_MAP[preset];
  if (!canCreateRole(actorRole, targetRole)) {
    throw new ApiRequestError(`Your role cannot assign the ${preset} preset`, 403);
  }
}

export function buildPresetPermissions(
  preset: PermissionPreset,
  overrides?: Partial<Record<string, PermissionLevel>>
): ModulePermissions {
  const base = PERMISSION_PRESETS[preset];
  const merged = { ...base };

  for (const module of MODULES) {
    const override = overrides?.[module];
    if (override) {
      merged[module] = override;
    }
  }

  return merged;
}

export function buildDangerousPrivileges(
  preset: PermissionPreset,
  overrides?: Partial<DangerousPrivileges>
): DangerousPrivileges {
  return {
    ...PRESET_DANGEROUS_DEFAULTS[preset],
    ...overrides,
  };
}

function getInvokerLevel(invoker: UserWithGrants, module: Module): PermissionLevel {
  if (invoker.accessGrants.length === 0 && canAccessUserAdmin(invoker.role as UserRole)) {
    return "full";
  }

  return getEffectiveLevel(
    invoker.accessGrants,
    module,
    "org",
    invoker.organizationId ?? undefined
  );
}

export function assertGrantedModulesWithinInvoker(
  invoker: UserWithGrants,
  targetPermissions: ModulePermissions
): void {
  for (const module of MODULES) {
    const targetLevel = targetPermissions[module];
    const invokerLevel = getInvokerLevel(invoker, module);

    if (LEVEL_RANK[targetLevel] > LEVEL_RANK[invokerLevel]) {
      throw new ApiRequestError(
        `Cannot grant ${targetLevel} on ${module} - exceeds your own access level (${invokerLevel})`,
        403
      );
    }
  }
}

export function assertGrantedDangerousPrivilegesWithinInvoker(
  invoker: Pick<UserWithGrants, DangerousPrivilegeKey>,
  targetDangerous: Partial<DangerousPrivileges>
): void {
  const keys = Object.keys(DANGEROUS_PRIVILEGE_LABELS) as DangerousPrivilegeKey[];

  for (const key of keys) {
    if (targetDangerous[key] && !invoker[key]) {
      throw new ApiRequestError(
        `Cannot grant permission to ${DANGEROUS_PRIVILEGE_LABELS[key]}`,
        403
      );
    }
  }
}
