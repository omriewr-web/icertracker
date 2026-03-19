import { describe, it, expect } from "vitest";

/**
 * Tests for FIX 4: Meter Import Deduplication
 * Validates the meter matching hierarchy: accountNumber > meterNumber+type > unit+type
 */

interface MockMeter {
  id: string;
  buildingId: string;
  meterNumber: string | null;
  utilityType: string;
  unitId: string | null;
  accounts: { accountNumber: string | null }[];
}

interface ImportRow {
  accountNumber?: string;
  meterNumber?: string;
  unitNumber?: string;
  provider: string;
}

// Simulates the matching hierarchy from the import route
function findMatchingMeter(
  meters: MockMeter[],
  row: ImportRow,
  buildingId: string
): { meter: MockMeter | null; matchedBy: string | null } {
  const inferredType = row.provider.toLowerCase().includes("water")
    ? "water"
    : row.provider.toLowerCase().includes("gas") || row.provider.toLowerCase().includes("grid")
    ? "gas"
    : "electric";

  // 1. Match by account number
  if (row.accountNumber) {
    const byAccount = meters.find(
      (m) => m.buildingId === buildingId && m.accounts.some((a) => a.accountNumber === row.accountNumber)
    );
    if (byAccount) return { meter: byAccount, matchedBy: "accountNumber" };
  }

  // 2. Match by meter number + utility type
  if (row.meterNumber) {
    const byMeter = meters.find(
      (m) => m.buildingId === buildingId && m.meterNumber === row.meterNumber && m.utilityType === inferredType
    );
    if (byMeter) return { meter: byMeter, matchedBy: "meterNumber" };
  }

  // 3. Match by unit + utility type (simplified — real code looks up unit by number)
  if (row.unitNumber) {
    const byUnit = meters.find(
      (m) => m.buildingId === buildingId && m.unitId === row.unitNumber && m.utilityType === inferredType
    );
    if (byUnit) return { meter: byUnit, matchedBy: "unit+type" };
  }

  return { meter: null, matchedBy: null };
}

const testMeters: MockMeter[] = [
  {
    id: "m1",
    buildingId: "b1",
    meterNumber: "MTR-001",
    utilityType: "electric",
    unitId: "u1",
    accounts: [{ accountNumber: "ACCT-100" }],
  },
  {
    id: "m2",
    buildingId: "b1",
    meterNumber: "MTR-002",
    utilityType: "gas",
    unitId: "u1",
    accounts: [],
  },
  {
    id: "m3",
    buildingId: "b1",
    meterNumber: null,
    utilityType: "water",
    unitId: "u2",
    accounts: [],
  },
];

describe("Meter Import Deduplication", () => {
  it("matches by account number first", () => {
    const result = findMatchingMeter(
      testMeters,
      { accountNumber: "ACCT-100", meterNumber: "MTR-999", provider: "Con Edison" },
      "b1"
    );
    expect(result.meter?.id).toBe("m1");
    expect(result.matchedBy).toBe("accountNumber");
  });

  it("falls back to meter number + type when no account number", () => {
    const result = findMatchingMeter(
      testMeters,
      { meterNumber: "MTR-002", provider: "National Grid" },
      "b1"
    );
    expect(result.meter?.id).toBe("m2");
    expect(result.matchedBy).toBe("meterNumber");
  });

  it("falls back to unit + type when no account or meter number", () => {
    const result = findMatchingMeter(
      testMeters,
      { unitNumber: "u2", provider: "Water Authority" },
      "b1"
    );
    expect(result.meter?.id).toBe("m3");
    expect(result.matchedBy).toBe("unit+type");
  });

  it("returns null when no match found", () => {
    const result = findMatchingMeter(
      testMeters,
      { meterNumber: "MTR-999", provider: "Con Edison" },
      "b1"
    );
    expect(result.meter).toBeNull();
    expect(result.matchedBy).toBeNull();
  });

  it("does not cross-match between buildings", () => {
    const result = findMatchingMeter(
      testMeters,
      { accountNumber: "ACCT-100", provider: "Con Edison" },
      "b2" // different building
    );
    expect(result.meter).toBeNull();
  });

  it("does not match meter number when utility type differs", () => {
    // MTR-001 is electric, but we're looking for water
    const result = findMatchingMeter(
      testMeters,
      { meterNumber: "MTR-001", provider: "Water Authority" },
      "b1"
    );
    expect(result.meter).toBeNull();
  });

  it("prioritizes account number over meter number", () => {
    // Row has both — account number should win
    const result = findMatchingMeter(
      testMeters,
      { accountNumber: "ACCT-100", meterNumber: "MTR-002", provider: "National Grid" },
      "b1"
    );
    expect(result.meter?.id).toBe("m1");
    expect(result.matchedBy).toBe("accountNumber");
  });
});
