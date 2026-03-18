// ── Permission system v2 — preset definitions ──────────────

import type { PermissionPreset, ModulePermissions, DangerousPrivileges } from "./types";

export const PERMISSION_PRESETS: Record<PermissionPreset, ModulePermissions> = {
  property_manager: {
    collections: "edit",
    operations: "edit",
    leasing: "view",
    violations: "edit",
    legal: "view",
    reporting: "view",
    owner_view: "none",
    admin: "none",
  },
  ar_clerk: {
    collections: "full",
    operations: "none",
    leasing: "none",
    violations: "view",
    legal: "view",
    reporting: "edit",
    owner_view: "none",
    admin: "none",
  },
  leasing_agent: {
    collections: "none",
    operations: "view",
    leasing: "full",
    violations: "none",
    legal: "none",
    reporting: "view",
    owner_view: "none",
    admin: "none",
  },
  building_super: {
    collections: "none",
    operations: "edit",
    leasing: "none",
    violations: "view",
    legal: "none",
    reporting: "none",
    owner_view: "none",
    admin: "none",
  },
  reporting_only: {
    collections: "view",
    operations: "view",
    leasing: "view",
    violations: "view",
    legal: "view",
    reporting: "full",
    owner_view: "none",
    admin: "none",
  },
  owner_investor: {
    collections: "view",
    operations: "none",
    leasing: "view",
    violations: "view",
    legal: "view",
    reporting: "view",
    owner_view: "full",
    admin: "none",
  },
  account_admin: {
    collections: "full",
    operations: "full",
    leasing: "full",
    violations: "full",
    legal: "full",
    reporting: "full",
    owner_view: "full",
    admin: "full",
  },
};

const ALL_FALSE: DangerousPrivileges = {
  canExportSensitive: false,
  canDeleteRecords: false,
  canBulkUpdate: false,
  canManageUsers: false,
  canManageOrgSettings: false,
};

const ALL_TRUE: DangerousPrivileges = {
  canExportSensitive: true,
  canDeleteRecords: true,
  canBulkUpdate: true,
  canManageUsers: true,
  canManageOrgSettings: true,
};

export const PRESET_DANGEROUS_DEFAULTS: Record<PermissionPreset, DangerousPrivileges> = {
  property_manager: { ...ALL_FALSE },
  ar_clerk: { ...ALL_FALSE, canBulkUpdate: true },
  leasing_agent: { ...ALL_FALSE },
  building_super: { ...ALL_FALSE },
  reporting_only: { ...ALL_FALSE },
  owner_investor: { ...ALL_FALSE },
  account_admin: { ...ALL_TRUE },
};
