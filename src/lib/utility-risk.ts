/**
 * Utility meter/account risk flag calculation.
 */

export type UtilityRiskFlag =
  | "unassigned"
  | "missing_account_number"
  | "missing_meter_number"
  | "occupied_owner_paid"
  | "vacant_tenant_account"
  | "closed_with_balance"
  | "no_monthly_check"
  | "ok";

interface MeterForRisk {
  meterNumber: string | null;
  isActive: boolean;
  unit: { isVacant: boolean; tenant: { id: string } | null } | null;
  accounts: {
    status: string;
    accountNumber: string | null;
    assignedPartyType: string;
    closedWithBalance: boolean | null;
  }[];
}

export function computeRiskFlags(meter: MeterForRisk): UtilityRiskFlag[] {
  const flags: UtilityRiskFlag[] = [];

  if (!meter.isActive) return ["ok"];

  // Missing meter number
  if (!meter.meterNumber?.trim()) {
    flags.push("missing_meter_number");
  }

  const activeAccounts = meter.accounts.filter((a) => a.status === "active");
  const closedAccounts = meter.accounts.filter((a) => a.status === "closed");

  // Unassigned — active meter with no active account
  if (activeAccounts.length === 0) {
    flags.push("unassigned");
  }

  for (const acc of activeAccounts) {
    // Missing account number
    if (!acc.accountNumber?.trim()) {
      flags.push("missing_account_number");
    }

    // Occupied unit but owner/management-paid
    if (
      meter.unit &&
      !meter.unit.isVacant &&
      meter.unit.tenant &&
      (acc.assignedPartyType === "owner" || acc.assignedPartyType === "management")
    ) {
      flags.push("occupied_owner_paid");
    }

    // Vacant unit but tenant still on account
    if (
      meter.unit &&
      meter.unit.isVacant &&
      acc.assignedPartyType === "tenant"
    ) {
      flags.push("vacant_tenant_account");
    }
  }

  // Closed with balance
  for (const acc of closedAccounts) {
    if (acc.closedWithBalance === true) {
      flags.push("closed_with_balance");
    }
  }

  return flags.length > 0 ? [...new Set(flags)] : ["ok"];
}

export function primaryRiskFlag(flags: UtilityRiskFlag[]): UtilityRiskFlag {
  // Priority order (most critical first)
  const priority: UtilityRiskFlag[] = [
    "vacant_tenant_account",
    "closed_with_balance",
    "occupied_owner_paid",
    "unassigned",
    "missing_account_number",
    "missing_meter_number",
    "no_monthly_check",
    "ok",
  ];
  for (const p of priority) {
    if (flags.includes(p)) return p;
  }
  return "ok";
}

export function riskFlagColor(flag: UtilityRiskFlag): "red" | "amber" | "yellow" | "green" {
  switch (flag) {
    case "vacant_tenant_account":
    case "closed_with_balance":
      return "red";
    case "occupied_owner_paid":
    case "unassigned":
      return "amber";
    case "missing_account_number":
    case "missing_meter_number":
    case "no_monthly_check":
      return "yellow";
    case "ok":
    default:
      return "green";
  }
}

export function riskFlagLabel(flag: UtilityRiskFlag): string {
  switch (flag) {
    case "vacant_tenant_account": return "Vacant - Tenant Account";
    case "closed_with_balance": return "Closed w/ Balance";
    case "occupied_owner_paid": return "Occupied - Owner Paid";
    case "unassigned": return "Unassigned";
    case "missing_account_number": return "No Account #";
    case "missing_meter_number": return "No Meter #";
    case "no_monthly_check": return "No Monthly Check";
    case "ok": return "OK";
  }
}
