/**
 * W4-D: Owner data visibility tests
 *
 * Tests that OWNER role has correct read/write permissions,
 * proper data scoping via getBuildingScope/getTenantScope,
 * and cannot access internal management data.
 */
import { describe, it, expect, vi } from "vitest";
import {
  canAccessModule,
  canWriteModule,
  MODULE_PERMISSIONS,
} from "@/lib/permissions";
import {
  getBuildingScope,
  getBuildingIdScope,
  getTenantScope,
  EMPTY_SCOPE,
} from "@/lib/data-scope";

// Mock prisma for data-scope
vi.mock("@/lib/prisma", () => ({
  prisma: {
    building: { findUnique: vi.fn().mockResolvedValue({ organizationId: "org-1" }) },
    tenant: { findUnique: vi.fn() },
    workOrder: { findUnique: vi.fn() },
    unit: { findUnique: vi.fn() },
    complianceItem: { findUnique: vi.fn() },
  },
}));

// ── Test users ──────────────────────────────────────────────────────────

const ownerWithBuildings = {
  role: "OWNER" as const,
  assignedProperties: ["bld-1", "bld-2"],
  organizationId: "org-1",
};

const ownerNoBuildings = {
  role: "OWNER" as const,
  assignedProperties: [],
  organizationId: "org-1",
};

const admin = {
  role: "ADMIN" as const,
  assignedProperties: [],
  organizationId: "org-1",
};

// ── OWNER permission matrix tests ──────────────────────────────────────

describe("OWNER module permissions", () => {
  it("OWNER can read owner-dashboard", () => {
    expect(canAccessModule("OWNER", "owner-dashboard")).toBe(true);
  });

  it("OWNER can read collections (read-only)", () => {
    expect(canAccessModule("OWNER", "collections")).toBe(true);
  });

  it("OWNER cannot write to collections", () => {
    expect(canWriteModule("OWNER", "collections")).toBe(false);
  });

  it("OWNER can read legal", () => {
    expect(canAccessModule("OWNER", "legal")).toBe(true);
  });

  it("OWNER cannot write to legal", () => {
    expect(canWriteModule("OWNER", "legal")).toBe(false);
  });

  it("OWNER can read tenants (read-only)", () => {
    expect(canAccessModule("OWNER", "tenants")).toBe(true);
  });

  it("OWNER cannot write to tenants", () => {
    expect(canWriteModule("OWNER", "tenants")).toBe(false);
  });

  it("OWNER can read vacancies", () => {
    expect(canAccessModule("OWNER", "vacancies")).toBe(true);
  });

  it("OWNER cannot write to vacancies", () => {
    expect(canWriteModule("OWNER", "vacancies")).toBe(false);
  });

  it("OWNER cannot access main dashboard", () => {
    expect(canAccessModule("OWNER", "dashboard")).toBe(false);
  });

  it("OWNER cannot access utilities", () => {
    expect(canAccessModule("OWNER", "utilities")).toBe(false);
  });

  it("OWNER cannot access user management", () => {
    expect(canAccessModule("OWNER", "users")).toBe(false);
  });

  it("OWNER cannot access data-import", () => {
    expect(canAccessModule("OWNER", "data-import")).toBe(false);
  });

  it("OWNER cannot access settings", () => {
    expect(canAccessModule("OWNER", "settings")).toBe(false);
  });

  it("OWNER cannot access organizations", () => {
    expect(canAccessModule("OWNER", "organizations")).toBe(false);
  });

  it("OWNER has zero write permissions across all modules", () => {
    const ownerPerms = MODULE_PERMISSIONS.OWNER;
    for (const [module, access] of Object.entries(ownerPerms)) {
      expect(access.write, `OWNER should not have write for ${module}`).toBe(false);
    }
  });
});

// ── OWNER data scoping tests ───────────────────────────────────────────

describe("OWNER data scoping via getBuildingScope", () => {
  it("OWNER with assigned buildings sees only their buildings", () => {
    const scope = getBuildingScope(ownerWithBuildings);
    expect(scope).not.toBe(EMPTY_SCOPE);
    expect(scope).toEqual({
      buildingId: { in: ["bld-1", "bld-2"] },
      building: { organizationId: "org-1" },
    });
  });

  it("OWNER with no assigned buildings sees nothing", () => {
    const scope = getBuildingScope(ownerNoBuildings);
    expect(scope).toBe(EMPTY_SCOPE);
  });

  it("OWNER cannot access unassigned building", () => {
    const scope = getBuildingScope(ownerWithBuildings, "bld-99");
    expect(scope).toBe(EMPTY_SCOPE);
  });

  it("OWNER can access assigned building", () => {
    const scope = getBuildingScope(ownerWithBuildings, "bld-1");
    expect(scope).not.toBe(EMPTY_SCOPE);
  });
});

describe("OWNER data scoping via getBuildingIdScope", () => {
  it("OWNER with buildings scoped to assigned IDs + org", () => {
    const scope = getBuildingIdScope(ownerWithBuildings);
    expect(scope).toEqual({
      id: { in: ["bld-1", "bld-2"] },
      organizationId: "org-1",
    });
  });

  it("OWNER with no buildings gets EMPTY_SCOPE", () => {
    expect(getBuildingIdScope(ownerNoBuildings)).toBe(EMPTY_SCOPE);
  });

  it("OWNER requesting unassigned building gets EMPTY_SCOPE", () => {
    expect(getBuildingIdScope(ownerWithBuildings, "bld-99")).toBe(EMPTY_SCOPE);
  });
});

describe("OWNER data scoping via getTenantScope", () => {
  it("OWNER sees tenants in assigned buildings only", () => {
    const scope = getTenantScope(ownerWithBuildings);
    expect(scope).toEqual({
      unit: {
        buildingId: { in: ["bld-1", "bld-2"] },
        building: { organizationId: "org-1" },
      },
    });
  });

  it("OWNER with no buildings sees no tenants", () => {
    expect(getTenantScope(ownerNoBuildings)).toBe(EMPTY_SCOPE);
  });
});

// ── ADMIN vs OWNER comparison tests ────────────────────────────────────

describe("OWNER vs ADMIN visibility differences", () => {
  it("ADMIN can access dashboard, OWNER cannot", () => {
    expect(canAccessModule("ADMIN", "dashboard")).toBe(true);
    expect(canAccessModule("OWNER", "dashboard")).toBe(false);
  });

  it("ADMIN can write to collections, OWNER cannot", () => {
    expect(canWriteModule("ADMIN", "collections")).toBe(true);
    expect(canWriteModule("OWNER", "collections")).toBe(false);
  });

  it("ADMIN can access users, OWNER cannot", () => {
    expect(canAccessModule("ADMIN", "users")).toBe(true);
    expect(canAccessModule("OWNER", "users")).toBe(false);
  });

  it("ADMIN sees all org buildings, OWNER sees only assigned", () => {
    const adminScope = getBuildingIdScope(admin);
    const ownerScope = getBuildingIdScope(ownerWithBuildings);
    // ADMIN: org-wide scope (no id filter)
    expect(adminScope).toEqual({ organizationId: "org-1" });
    // OWNER: id-restricted + org scope
    expect(ownerScope).toEqual({ id: { in: ["bld-1", "bld-2"] }, organizationId: "org-1" });
  });
});

// ── EMPTY_SCOPE sentinel behavior ──────────────────────────────────────

describe("EMPTY_SCOPE sentinel", () => {
  it("is a unique symbol that does not equal empty object", () => {
    expect(EMPTY_SCOPE).not.toEqual({});
  });

  it("is consistent across calls", () => {
    const a = getBuildingScope(ownerNoBuildings);
    const b = getBuildingScope(ownerNoBuildings);
    expect(a).toBe(EMPTY_SCOPE);
    expect(b).toBe(EMPTY_SCOPE);
    expect(a).toBe(b);
  });
});
