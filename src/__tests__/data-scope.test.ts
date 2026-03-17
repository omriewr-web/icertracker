/**
 * Regression tests for centralized authorization scoping (data-scope.ts).
 *
 * Covers fixes:
 *   A. Buildings API scope (getBuildingIdScope)
 *   B. Work order building access (canAccessBuilding / assertBuildingAccess)
 *   7. Standardized route-level authorization via centralized helpers
 *   C. Organization isolation (ADMIN scoped to their org, SUPER_ADMIN sees all)
 */
import { describe, it, expect, vi } from "vitest";
import {
  getBuildingScope,
  getBuildingIdScope,
  getTenantScope,
  canAccessBuilding,
  EMPTY_SCOPE,
} from "@/lib/data-scope";

// Mock prisma for canAccessBuilding async DB lookups
vi.mock("@/lib/prisma", () => ({
  prisma: {
    building: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: "org-1" }),
    },
    tenant: { findUnique: vi.fn() },
    workOrder: { findUnique: vi.fn() },
    unit: { findUnique: vi.fn() },
    complianceItem: { findUnique: vi.fn() },
  },
}));

// ── Test users ──

const superAdmin = { role: "SUPER_ADMIN", assignedProperties: [], organizationId: "org-1" };
const admin = { role: "ADMIN", assignedProperties: [], organizationId: "org-1" };
const scopedUser = { role: "PM", assignedProperties: ["bld-1", "bld-2"], organizationId: "org-1" };
const emptyUser = { role: "PM", assignedProperties: [], organizationId: "org-1" };
const nullUser = { role: "COLLECTOR", assignedProperties: null, organizationId: "org-1" };
const undefinedUser = { role: "COLLECTOR" } as any;

// ─────────────────────────────────────────────────────────────────────────────
// A. Buildings API — getBuildingIdScope
// ─────────────────────────────────────────────────────────────────────────────

describe("getBuildingIdScope", () => {
  it("SUPER_ADMIN sees all buildings (empty where clause)", () => {
    const scope = getBuildingIdScope(superAdmin);
    expect(scope).toEqual({});
  });

  it("ADMIN sees only their org's buildings", () => {
    const scope = getBuildingIdScope(admin);
    expect(scope).toEqual({ organizationId: "org-1" });
  });

  it("scoped user sees only assigned buildings", () => {
    const scope = getBuildingIdScope(scopedUser);
    expect(scope).toEqual({ id: { in: ["bld-1", "bld-2"] }, organizationId: "org-1" });
  });

  it("non-admin with empty assignedProperties gets EMPTY_SCOPE", () => {
    expect(getBuildingIdScope(emptyUser)).toBe(EMPTY_SCOPE);
  });

  it("non-admin with null assignedProperties gets EMPTY_SCOPE", () => {
    expect(getBuildingIdScope(nullUser)).toBe(EMPTY_SCOPE);
  });

  it("non-admin with undefined assignedProperties gets EMPTY_SCOPE", () => {
    expect(getBuildingIdScope(undefinedUser)).toBe(EMPTY_SCOPE);
  });

  it("SUPER_ADMIN with explicit buildingId gets scoped to that building", () => {
    const scope = getBuildingIdScope(superAdmin, "bld-99");
    expect(scope).toEqual({ id: "bld-99" });
  });

  it("ADMIN with explicit buildingId also scopes by org", () => {
    const scope = getBuildingIdScope(admin, "bld-99");
    expect(scope).toEqual({ id: "bld-99", organizationId: "org-1" });
  });

  it("scoped user with assigned explicit buildingId gets access", () => {
    const scope = getBuildingIdScope(scopedUser, "bld-1");
    expect(scope).toEqual({ id: "bld-1", organizationId: "org-1" });
  });

  it("scoped user with unassigned explicit buildingId gets EMPTY_SCOPE", () => {
    expect(getBuildingIdScope(scopedUser, "bld-99")).toBe(EMPTY_SCOPE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. Work order / generic building access — canAccessBuilding (now async)
// ─────────────────────────────────────────────────────────────────────────────

describe("canAccessBuilding", () => {
  it("SUPER_ADMIN can access any building", async () => {
    expect(await canAccessBuilding(superAdmin, "any-building")).toBe(true);
  });

  it("ADMIN can access building in their org", async () => {
    expect(await canAccessBuilding(admin, "bld-in-org")).toBe(true);
  });

  it("scoped user can access assigned building", async () => {
    expect(await canAccessBuilding(scopedUser, "bld-1")).toBe(true);
  });

  it("scoped user cannot access unassigned building", async () => {
    expect(await canAccessBuilding(scopedUser, "bld-99")).toBe(false);
  });

  it("user with no assignments cannot access any building", async () => {
    expect(await canAccessBuilding(emptyUser, "bld-1")).toBe(false);
  });

  it("user with null assignments cannot access any building", async () => {
    expect(await canAccessBuilding(nullUser, "bld-1")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Organization isolation — getBuildingScope
// ─────────────────────────────────────────────────────────────────────────────

describe("getBuildingScope", () => {
  it("SUPER_ADMIN sees all (empty where)", () => {
    expect(getBuildingScope(superAdmin)).toEqual({});
  });

  it("ADMIN scoped to their org's buildings", () => {
    expect(getBuildingScope(admin)).toEqual({ building: { organizationId: "org-1" } });
  });

  it("scoped user gets buildingId filter", () => {
    expect(getBuildingScope(scopedUser)).toEqual({ buildingId: { in: ["bld-1", "bld-2"] }, building: { organizationId: "org-1" } });
  });

  it("empty user gets EMPTY_SCOPE", () => {
    expect(getBuildingScope(emptyUser)).toBe(EMPTY_SCOPE);
  });

  it("null assignments gets EMPTY_SCOPE", () => {
    expect(getBuildingScope(nullUser)).toBe(EMPTY_SCOPE);
  });

  it("explicit buildingId for SUPER_ADMIN restricts to single building", () => {
    const scope = getBuildingScope(superAdmin, "bld-5");
    expect(scope).toEqual({ buildingId: { in: ["bld-5"] } });
  });

  it("explicit buildingId for ADMIN also scopes by org", () => {
    const scope = getBuildingScope(admin, "bld-5");
    expect(scope).toEqual({ buildingId: { in: ["bld-5"] }, building: { organizationId: "org-1" } });
  });

  it("explicit unassigned buildingId for scoped user returns EMPTY_SCOPE", () => {
    expect(getBuildingScope(scopedUser, "bld-99")).toBe(EMPTY_SCOPE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getTenantScope (used by metrics, export, daily-summary, etc.)
// ─────────────────────────────────────────────────────────────────────────────

describe("getTenantScope", () => {
  it("SUPER_ADMIN sees all tenants (empty where)", () => {
    expect(getTenantScope(superAdmin)).toEqual({});
  });

  it("ADMIN scoped to their org's tenants", () => {
    expect(getTenantScope(admin)).toEqual({ unit: { building: { organizationId: "org-1" } } });
  });

  it("scoped user gets nested unit.buildingId filter", () => {
    expect(getTenantScope(scopedUser)).toEqual({ unit: { buildingId: { in: ["bld-1", "bld-2"] }, building: { organizationId: "org-1" } } });
  });

  it("empty user gets EMPTY_SCOPE", () => {
    expect(getTenantScope(emptyUser)).toBe(EMPTY_SCOPE);
  });

  it("explicit buildingId for SUPER_ADMIN scopes to that building", () => {
    expect(getTenantScope(superAdmin, "bld-5")).toEqual({ unit: { buildingId: "bld-5" } });
  });

  it("explicit buildingId for ADMIN also scopes by org", () => {
    expect(getTenantScope(admin, "bld-5")).toEqual({
      unit: { buildingId: "bld-5", building: { organizationId: "org-1" } },
    });
  });

  it("explicit unassigned buildingId returns EMPTY_SCOPE", () => {
    expect(getTenantScope(scopedUser, "bld-99")).toBe(EMPTY_SCOPE);
  });
});
