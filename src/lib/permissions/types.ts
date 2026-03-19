// ── Permission system v2 — types ────────────────────────────

export type Module =
  | "collections"
  | "operations"
  | "leasing"
  | "violations"
  | "legal"
  | "reporting"
  | "owner_view"
  | "admin";

export type PermissionLevel = "none" | "view" | "edit" | "full";

export type ScopeType = "org" | "portfolio" | "building" | "assigned";

export type ModulePermissions = Record<Module, PermissionLevel>;

export type PermissionPreset =
  | "property_manager"
  | "ar_clerk"
  | "leasing_agent"
  | "building_super"
  | "reporting_only"
  | "owner_investor"
  | "account_admin";

export interface DangerousPrivileges {
  canExportSensitive: boolean;
  canDeleteRecords: boolean;
  canBulkUpdate: boolean;
  canManageUsers: boolean;
  canManageOrgSettings: boolean;
}

export const MODULES: Module[] = [
  "collections",
  "operations",
  "leasing",
  "violations",
  "legal",
  "reporting",
  "owner_view",
  "admin",
];

export const LEVELS: PermissionLevel[] = ["none", "view", "edit", "full"];

export const LEVEL_RANK: Record<PermissionLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  full: 3,
};

export const MODULE_LABELS: Record<Module, string> = {
  collections: "Collections & AR",
  operations: "Operations & Maintenance",
  leasing: "Leasing & Vacancies",
  violations: "Violations & Compliance",
  legal: "Legal Cases",
  reporting: "Reporting & Exports",
  owner_view: "Owner Portal",
  admin: "Admin & Settings",
};

export const PRESET_LABELS: Record<PermissionPreset, string> = {
  property_manager: "Property Manager",
  ar_clerk: "AR / Collections Specialist",
  leasing_agent: "Leasing Agent",
  building_super: "Building Super",
  reporting_only: "Read Only / Reporting",
  owner_investor: "Owner / Investor",
  account_admin: "Account Admin",
};
