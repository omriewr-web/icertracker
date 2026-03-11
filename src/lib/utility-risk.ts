/**
 * Utility meter/account risk flag calculation.
 */

export type UtilityRiskFlag =
  | "transfer_needed"
  | "unassigned"
  | "missing_account_number"
  | "missing_meter_number"
  | "occupied_owner_paid"
  | "vacant_tenant_account"
  | "closed_with_balance"
  | "no_monthly_check"
  | "meter_missing_unit"
  | "ok";

interface MeterForRisk {
  meterNumber: string | null;
  isActive: boolean;
  utilityType?: string;
  unitId?: string | null;
  unit: {
    isVacant: boolean;
    tenant: {
      id: string;
      leaseExpiration?: Date | string | null;
      moveOutDate?: Date | string | null;
      leaseStatus?: string | null;
    } | null;
  } | null;
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

    // Transfer needed — tenant on account but lease expired or moved out
    if (
      acc.assignedPartyType === "tenant" &&
      meter.unit?.tenant
    ) {
      const now = new Date();
      const lease = meter.unit.tenant.leaseExpiration ? new Date(meter.unit.tenant.leaseExpiration) : null;
      const moveOut = meter.unit.tenant.moveOutDate ? new Date(meter.unit.tenant.moveOutDate) : null;
      if ((lease && lease < now) || (moveOut && moveOut < now)) {
        flags.push("transfer_needed");
      }
    }
  }

  // Closed with balance
  for (const acc of closedAccounts) {
    if (acc.closedWithBalance === true) {
      flags.push("closed_with_balance");
    }
  }

  // Unit-specific meter types without unit link
  const unitSpecificTypes = ["electric", "gas", "water"];
  if (meter.utilityType && unitSpecificTypes.includes(meter.utilityType) && meter.unitId === null) {
    flags.push("meter_missing_unit");
  }

  return flags.length > 0 ? [...new Set(flags)] : ["ok"];
}

export function primaryRiskFlag(flags: UtilityRiskFlag[]): UtilityRiskFlag {
  // Priority order (most critical first)
  const priority: UtilityRiskFlag[] = [
    "transfer_needed",
    "vacant_tenant_account",
    "closed_with_balance",
    "occupied_owner_paid",
    "unassigned",
    "missing_account_number",
    "missing_meter_number",
    "meter_missing_unit",
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
    case "transfer_needed":
    case "vacant_tenant_account":
    case "closed_with_balance":
      return "red";
    case "occupied_owner_paid":
    case "unassigned":
      return "amber";
    case "missing_account_number":
    case "missing_meter_number":
    case "meter_missing_unit":
    case "no_monthly_check":
      return "yellow";
    case "ok":
    default:
      return "green";
  }
}

export function riskFlagLabel(flag: UtilityRiskFlag): string {
  switch (flag) {
    case "transfer_needed": return "Transfer Needed";
    case "vacant_tenant_account": return "Vacant - Tenant Account";
    case "closed_with_balance": return "Closed w/ Balance";
    case "occupied_owner_paid": return "Occupied - Owner Paid";
    case "unassigned": return "Unassigned";
    case "missing_account_number": return "No Account #";
    case "missing_meter_number": return "No Meter #";
    case "meter_missing_unit": return "Missing Unit Link";
    case "no_monthly_check": return "No Monthly Check";
    case "ok": return "OK";
  }
}
