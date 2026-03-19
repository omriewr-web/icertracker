import { describe, it, expect } from "vitest";

/**
 * Tests for FIX 1: One Active Account Per Meter
 * Validates that the business logic correctly prevents duplicate active accounts.
 */

// Simulate the duplicate-check logic from the account creation route
function checkDuplicateActive(
  existingAccounts: { status: string; id: string; accountNumber: string | null; startDate: Date | null }[],
  meterId: string
): { allowed: boolean; conflictMessage?: string } {
  const existingActive = existingAccounts.find((a) => a.status === "active");
  if (existingActive) {
    return {
      allowed: false,
      conflictMessage: `Meter ${meterId} already has an active account (id: ${existingActive.id}, account #: ${existingActive.accountNumber || "N/A"}).`,
    };
  }
  return { allowed: true };
}

describe("One Active Account Per Meter", () => {
  it("allows creating an account when no active accounts exist", () => {
    const result = checkDuplicateActive([], "meter-1");
    expect(result.allowed).toBe(true);
    expect(result.conflictMessage).toBeUndefined();
  });

  it("allows creating an account when all existing accounts are closed", () => {
    const result = checkDuplicateActive(
      [
        { status: "closed", id: "acc-1", accountNumber: "123", startDate: new Date("2024-01-01") },
        { status: "closed", id: "acc-2", accountNumber: "456", startDate: new Date("2024-06-01") },
      ],
      "meter-1"
    );
    expect(result.allowed).toBe(true);
  });

  it("blocks creating an account when an active account exists", () => {
    const result = checkDuplicateActive(
      [
        { status: "active", id: "acc-1", accountNumber: "123", startDate: new Date("2024-01-01") },
      ],
      "meter-1"
    );
    expect(result.allowed).toBe(false);
    expect(result.conflictMessage).toContain("already has an active account");
    expect(result.conflictMessage).toContain("acc-1");
  });

  it("blocks even when active account has no account number", () => {
    const result = checkDuplicateActive(
      [
        { status: "active", id: "acc-1", accountNumber: null, startDate: null },
      ],
      "meter-1"
    );
    expect(result.allowed).toBe(false);
    expect(result.conflictMessage).toContain("N/A");
  });

  it("allows creating when active account was mixed with closed", () => {
    const result = checkDuplicateActive(
      [
        { status: "closed", id: "acc-1", accountNumber: "old-123", startDate: new Date("2023-01-01") },
        { status: "active", id: "acc-2", accountNumber: "current-456", startDate: new Date("2024-06-01") },
      ],
      "meter-1"
    );
    expect(result.allowed).toBe(false);
    expect(result.conflictMessage).toContain("acc-2");
  });
});
