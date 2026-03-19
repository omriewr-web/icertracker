import { describe, expect, it } from "vitest";
import {
  assertCreatablePreset,
  assertGrantedDangerousPrivilegesWithinInvoker,
  assertManageExistingUser,
  assertUserAdminAccess,
} from "@/lib/user-management";

describe("user-management hardening", () => {
  it("blocks PMs from legacy user-admin routes", () => {
    expect(() => assertUserAdminAccess("PM")).toThrow(/Forbidden/);
  });

  it("blocks account admins from minting peer account-admin presets", () => {
    expect(() => assertCreatablePreset("ACCOUNT_ADMIN", "account_admin")).toThrow(
      /cannot assign the account_admin preset/i
    );
  });

  it("blocks account admins from managing peer account-admin users", () => {
    expect(() => assertManageExistingUser("ACCOUNT_ADMIN", "ACCOUNT_ADMIN")).toThrow(
      /Forbidden/
    );
  });

  it("blocks granting dangerous privileges the caller does not already hold", () => {
    expect(() =>
      assertGrantedDangerousPrivilegesWithinInvoker(
        {
          canExportSensitive: false,
          canDeleteRecords: false,
          canBulkUpdate: false,
          canManageUsers: true,
          canManageOrgSettings: false,
        },
        { canExportSensitive: true }
      )
    ).toThrow(/export sensitive data/i);
  });
});
