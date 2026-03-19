import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  building: {
    findUnique: vi.fn(),
  },
  unit: {
    findUnique: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
  },
  vendor: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  workOrder: {
    findUnique: vi.fn(),
  },
  violation: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

import {
  assertLinkedViolationMatchesBuilding,
  assertLinkedWorkOrderMatchesBuilding,
  validateWorkOrderRelations,
} from "@/lib/work-order-relations";

describe("work-order relation validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.building.findUnique.mockResolvedValue({ organizationId: "org-1" });
    prisma.unit.findUnique.mockResolvedValue({ buildingId: "bld-1" });
    prisma.tenant.findUnique.mockResolvedValue({
      unitId: "unit-1",
      unit: { buildingId: "bld-1" },
    });
    prisma.vendor.findUnique.mockResolvedValue({ organizationId: "org-1" });
    prisma.user.findUnique.mockResolvedValue({
      active: true,
      organizationId: "org-1",
      role: "PM",
    });
    prisma.workOrder.findUnique.mockResolvedValue({ buildingId: "bld-1" });
    prisma.violation.findUnique.mockResolvedValue({ buildingId: "bld-1" });
  });

  it("rejects a unit from another building", async () => {
    prisma.unit.findUnique.mockResolvedValue({ buildingId: "bld-2" });

    await expect(
      validateWorkOrderRelations({ buildingId: "bld-1", unitId: "unit-2" })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a tenant that does not belong to the selected unit", async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      unitId: "unit-99",
      unit: { buildingId: "bld-1" },
    });

    await expect(
      validateWorkOrderRelations({
        buildingId: "bld-1",
        unitId: "unit-1",
        tenantId: "tenant-1",
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a vendor from another organization", async () => {
    prisma.vendor.findUnique.mockResolvedValue({ organizationId: "org-2" });

    await expect(
      validateWorkOrderRelations({ buildingId: "bld-1", vendorId: "vendor-2" })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects assigning an inactive user", async () => {
    prisma.user.findUnique.mockResolvedValue({
      active: false,
      organizationId: "org-1",
      role: "PM",
    });

    await expect(
      validateWorkOrderRelations({ buildingId: "bld-1", assignedToId: "user-2" })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects linking a work order from a different building", async () => {
    prisma.workOrder.findUnique.mockResolvedValue({ buildingId: "bld-2" });

    await expect(
      assertLinkedWorkOrderMatchesBuilding("wo-2", "bld-1")
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects linking a violation from a different building", async () => {
    prisma.violation.findUnique.mockResolvedValue({ buildingId: "bld-2" });

    await expect(
      assertLinkedViolationMatchesBuilding("vio-2", "bld-1")
    ).rejects.toMatchObject({ status: 400 });
  });
});
