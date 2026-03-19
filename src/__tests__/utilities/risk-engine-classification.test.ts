import { describe, it, expect } from "vitest";
import { computeRiskFlags } from "@/lib/utility-risk";

/**
 * Tests for FIX 5: Meter Classification & Risk Engine
 * Verifies that building_master and common_area meters don't trigger false-positive
 * missing-unit alerts, while unit_submeter still does.
 */

describe("Risk Engine Classification", () => {
  const baseMeter = {
    meterNumber: "MTR-001",
    isActive: true,
    unitId: null as string | null,
    unit: null,
    accounts: [{ status: "active", accountNumber: "ACCT-1", assignedPartyType: "owner", closedWithBalance: null }],
  };

  it("flags unit_submeter without unitId as meter_missing_unit", () => {
    const flags = computeRiskFlags({
      ...baseMeter,
      utilityType: "electric",
      classification: "unit_submeter",
    });
    expect(flags).toContain("meter_missing_unit");
  });

  it("does NOT flag building_master without unitId", () => {
    const flags = computeRiskFlags({
      ...baseMeter,
      utilityType: "electric",
      classification: "building_master",
    });
    expect(flags).not.toContain("meter_missing_unit");
  });

  it("does NOT flag common_area without unitId", () => {
    const flags = computeRiskFlags({
      ...baseMeter,
      utilityType: "water",
      classification: "common_area",
    });
    expect(flags).not.toContain("meter_missing_unit");
  });

  it("does NOT flag shared_meter without unitId", () => {
    const flags = computeRiskFlags({
      ...baseMeter,
      utilityType: "gas",
      classification: "shared_meter",
    });
    expect(flags).not.toContain("meter_missing_unit");
  });

  it("defaults to unit_submeter when classification is undefined", () => {
    const flags = computeRiskFlags({
      ...baseMeter,
      utilityType: "electric",
      // no classification field
    });
    expect(flags).toContain("meter_missing_unit");
  });

  it("does not flag common_electric or common_gas types regardless of classification", () => {
    // common_electric and common_gas are not in the unitSpecificTypes list
    const flags = computeRiskFlags({
      ...baseMeter,
      utilityType: "common_electric",
      classification: "unit_submeter",
    });
    expect(flags).not.toContain("meter_missing_unit");
  });

  it("still flags other risk conditions on non-unit-submeter meters", () => {
    const flags = computeRiskFlags({
      ...baseMeter,
      utilityType: "electric",
      classification: "building_master",
      meterNumber: null, // missing meter number should still be flagged
    });
    expect(flags).toContain("missing_meter_number");
    expect(flags).not.toContain("meter_missing_unit");
  });
});
