/**
 * Canonical permission matrix for AtlasPM roles.
 *
 * Module permissions control sidebar visibility and API route access.
 * Write permissions control whether a role can POST/PATCH/DELETE within a module.
 */

import type { UserRole } from "@/types";

export type Module =
  | "dashboard" | "properties" | "tenants" | "collections" | "legal"
  | "maintenance" | "compliance" | "vacancies" | "turnovers" | "utilities"
  | "owner-dashboard" | "coeus" | "reports" | "users" | "data-import"
  | "settings" | "organizations";

type LegacyPermission =
  | "allProps" | "dash" | "notes" | "pay" | "legal" | "upload" | "users"
  | "vac" | "lease" | "fin" | "reports" | "edit" | "email" | "maintenance"
  | "compliance" | "collections" | "utilities" | "owner" | "orgs";

interface ModuleAccess {
  read: boolean;
  write: boolean;
}

const ALL_RW: ModuleAccess = { read: true, write: true };
const READ_ONLY: ModuleAccess = { read: true, write: false };
const NO_ACCESS: ModuleAccess = { read: false, write: false };

type PermissionMatrix = Record<Module, ModuleAccess>;

export const MODULE_PERMISSIONS: Record<UserRole, PermissionMatrix> = {
  SUPER_ADMIN: {
    dashboard: ALL_RW, properties: ALL_RW, tenants: ALL_RW, collections: ALL_RW,
    legal: ALL_RW, maintenance: ALL_RW, compliance: ALL_RW, vacancies: ALL_RW,
    turnovers: ALL_RW, utilities: ALL_RW, "owner-dashboard": ALL_RW, coeus: ALL_RW,
    reports: ALL_RW, users: ALL_RW, "data-import": ALL_RW, settings: ALL_RW,
    organizations: ALL_RW,
  },
  ADMIN: {
    dashboard: ALL_RW, properties: ALL_RW, tenants: ALL_RW, collections: ALL_RW,
    legal: ALL_RW, maintenance: ALL_RW, compliance: ALL_RW, vacancies: ALL_RW,
    turnovers: ALL_RW, utilities: ALL_RW, "owner-dashboard": ALL_RW, coeus: ALL_RW,
    reports: ALL_RW, users: ALL_RW, "data-import": ALL_RW, settings: ALL_RW,
    organizations: NO_ACCESS,
  },
  ACCOUNT_ADMIN: {
    dashboard: ALL_RW, properties: ALL_RW, tenants: ALL_RW, collections: ALL_RW,
    legal: ALL_RW, maintenance: ALL_RW, compliance: ALL_RW, vacancies: ALL_RW,
    turnovers: ALL_RW, utilities: ALL_RW, "owner-dashboard": ALL_RW, coeus: ALL_RW,
    reports: ALL_RW, users: ALL_RW, "data-import": ALL_RW, settings: ALL_RW,
    organizations: NO_ACCESS,
  },
  PM: {
    dashboard: ALL_RW, properties: ALL_RW, tenants: ALL_RW, collections: ALL_RW,
    legal: ALL_RW, maintenance: ALL_RW, compliance: ALL_RW, vacancies: ALL_RW,
    turnovers: ALL_RW, utilities: ALL_RW, "owner-dashboard": ALL_RW, coeus: ALL_RW,
    reports: ALL_RW, users: NO_ACCESS, "data-import": ALL_RW, settings: NO_ACCESS,
    organizations: NO_ACCESS,
  },
  APM: {
    dashboard: ALL_RW, properties: ALL_RW, tenants: ALL_RW, collections: ALL_RW,
    legal: ALL_RW, maintenance: ALL_RW, compliance: ALL_RW, vacancies: ALL_RW,
    turnovers: ALL_RW, utilities: ALL_RW, "owner-dashboard": ALL_RW, coeus: ALL_RW,
    reports: ALL_RW, users: NO_ACCESS, "data-import": NO_ACCESS, settings: NO_ACCESS,
    organizations: NO_ACCESS,
  },
  COLLECTOR: {
    dashboard: ALL_RW, properties: READ_ONLY, tenants: ALL_RW, collections: ALL_RW,
    legal: NO_ACCESS, maintenance: ALL_RW, compliance: ALL_RW, vacancies: NO_ACCESS,
    turnovers: NO_ACCESS, utilities: ALL_RW, "owner-dashboard": NO_ACCESS, coeus: NO_ACCESS,
    reports: ALL_RW, users: NO_ACCESS, "data-import": NO_ACCESS, settings: NO_ACCESS,
    organizations: NO_ACCESS,
  },
  OWNER: {
    dashboard: NO_ACCESS, properties: READ_ONLY, tenants: READ_ONLY, collections: READ_ONLY,
    legal: READ_ONLY, maintenance: READ_ONLY, compliance: READ_ONLY, vacancies: READ_ONLY,
    turnovers: READ_ONLY, utilities: NO_ACCESS, "owner-dashboard": READ_ONLY, coeus: READ_ONLY,
    reports: READ_ONLY, users: NO_ACCESS, "data-import": NO_ACCESS, settings: NO_ACCESS,
    organizations: NO_ACCESS,
  },
  LEASING_SPECIALIST: {
    dashboard: NO_ACCESS, properties: READ_ONLY, tenants: READ_ONLY, collections: NO_ACCESS,
    legal: NO_ACCESS, maintenance: NO_ACCESS, compliance: NO_ACCESS, vacancies: ALL_RW,
    turnovers: ALL_RW, utilities: NO_ACCESS, "owner-dashboard": NO_ACCESS, coeus: NO_ACCESS,
    reports: READ_ONLY, users: NO_ACCESS, "data-import": NO_ACCESS, settings: NO_ACCESS,
    organizations: NO_ACCESS,
  },
  BROKER: {
    dashboard: NO_ACCESS, properties: READ_ONLY, tenants: NO_ACCESS, collections: NO_ACCESS,
    legal: NO_ACCESS, maintenance: NO_ACCESS, compliance: NO_ACCESS, vacancies: READ_ONLY,
    turnovers: NO_ACCESS, utilities: NO_ACCESS, "owner-dashboard": NO_ACCESS, coeus: NO_ACCESS,
    reports: READ_ONLY, users: NO_ACCESS, "data-import": NO_ACCESS, settings: NO_ACCESS,
    organizations: NO_ACCESS,
  },
  SUPER: {
    dashboard: NO_ACCESS, properties: READ_ONLY, tenants: READ_ONLY, collections: NO_ACCESS,
    legal: NO_ACCESS, maintenance: ALL_RW, compliance: READ_ONLY, vacancies: NO_ACCESS,
    turnovers: NO_ACCESS, utilities: NO_ACCESS, "owner-dashboard": NO_ACCESS, coeus: NO_ACCESS,
    reports: NO_ACCESS, users: NO_ACCESS, "data-import": NO_ACCESS, settings: NO_ACCESS,
    organizations: NO_ACCESS,
  },
  ACCOUNTING: {
    dashboard: NO_ACCESS, properties: READ_ONLY, tenants: READ_ONLY, collections: READ_ONLY,
    legal: READ_ONLY, maintenance: NO_ACCESS, compliance: NO_ACCESS, vacancies: NO_ACCESS,
    turnovers: NO_ACCESS, utilities: NO_ACCESS, "owner-dashboard": NO_ACCESS, coeus: NO_ACCESS,
    reports: ALL_RW, users: NO_ACCESS, "data-import": NO_ACCESS, settings: NO_ACCESS,
    organizations: NO_ACCESS,
  },
  LEASING_AGENT: {
    dashboard: ALL_RW, properties: READ_ONLY, tenants: READ_ONLY, collections: NO_ACCESS,
    legal: NO_ACCESS, maintenance: NO_ACCESS, compliance: NO_ACCESS, vacancies: ALL_RW,
    turnovers: ALL_RW, utilities: NO_ACCESS, "owner-dashboard": NO_ACCESS, coeus: NO_ACCESS,
    reports: NO_ACCESS, users: NO_ACCESS, "data-import": NO_ACCESS, settings: NO_ACCESS,
    organizations: NO_ACCESS,
  },
};

/** Check if a role can read (view) a module */
export function canAccessModule(role: UserRole, module: string): boolean {
  const perms = MODULE_PERMISSIONS[role];
  if (!perms) return false;
  const access = perms[module as Module];
  return access?.read ?? false;
}

/** Check if a role can write (create/edit/delete) within a module */
export function canWriteModule(role: UserRole, module: string): boolean {
  const perms = MODULE_PERMISSIONS[role];
  if (!perms) return false;
  const access = perms[module as Module];
  return access?.write ?? false;
}

const LEGACY_PERMISSION_CHECKS: Record<LegacyPermission, (role: UserRole) => boolean> = {
  allProps: (role) => ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN"].includes(role),
  dash: (role) => canAccessModule(role, "dashboard") || canAccessModule(role, "coeus"),
  notes: (role) => canAccessModule(role, "tenants"),
  pay: (role) => canWriteModule(role, "tenants"),
  legal: (role) => canAccessModule(role, "legal"),
  upload: (role) => canAccessModule(role, "data-import"),
  users: (role) => canAccessModule(role, "users"),
  vac: (role) => canAccessModule(role, "vacancies") || canAccessModule(role, "turnovers"),
  lease: (role) => canAccessModule(role, "tenants") || canAccessModule(role, "vacancies"),
  fin: (role) => canAccessModule(role, "collections") || canAccessModule(role, "reports"),
  reports: (role) => canAccessModule(role, "reports"),
  edit: (role) => Object.values(MODULE_PERMISSIONS[role]).some((access) => access.write),
  email: (role) => canWriteModule(role, "collections") || canWriteModule(role, "tenants"),
  maintenance: (role) => canAccessModule(role, "maintenance"),
  compliance: (role) => canAccessModule(role, "compliance"),
  collections: (role) => canAccessModule(role, "collections"),
  utilities: (role) => canAccessModule(role, "utilities"),
  owner: (role) => canAccessModule(role, "owner-dashboard"),
  orgs: (role) => canAccessModule(role, "organizations"),
};

export function hasPermission(role: UserRole, perm: string): boolean {
  const checker = LEGACY_PERMISSION_CHECKS[perm as LegacyPermission];
  return checker ? checker(role) : false;
}

/** Roles that a given role is allowed to create */
const CREATABLE_ROLES: Partial<Record<UserRole, UserRole[]>> = {
  SUPER_ADMIN: ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN", "PM", "APM", "COLLECTOR", "OWNER", "LEASING_SPECIALIST", "BROKER", "SUPER", "ACCOUNTING", "LEASING_AGENT"],
  ADMIN: ["ACCOUNT_ADMIN", "PM", "APM", "COLLECTOR", "OWNER", "LEASING_SPECIALIST", "BROKER", "SUPER", "ACCOUNTING", "LEASING_AGENT"],
  ACCOUNT_ADMIN: ["PM", "APM", "COLLECTOR", "OWNER", "LEASING_SPECIALIST", "BROKER", "SUPER", "ACCOUNTING", "LEASING_AGENT"],
};

/** Check if a role can create users of a target role */
export function canCreateRole(creatorRole: UserRole, targetRole: UserRole): boolean {
  const allowed = CREATABLE_ROLES[creatorRole];
  if (!allowed) return false;
  return allowed.includes(targetRole);
}

/** Get the list of roles a given role can create */
export function getCreatableRoles(role: UserRole): UserRole[] {
  return CREATABLE_ROLES[role] ?? [];
}
