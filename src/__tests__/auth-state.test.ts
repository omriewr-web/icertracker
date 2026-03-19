import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  userProperty: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

import { loadFreshAuthUserById } from "@/lib/auth-state";

describe("auth-state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for inactive users", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Inactive User",
      email: "inactive@example.com",
      role: "PM",
      organizationId: "org-1",
      managerId: null,
      onboardingComplete: true,
      active: false,
    });

    await expect(loadFreshAuthUserById("user-1")).resolves.toBeNull();
    expect(prisma.userProperty.findMany).not.toHaveBeenCalled();
  });

  it("inherits manager properties for manager-scoped roles", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-2",
      name: "Scoped APM",
      email: "apm@example.com",
      role: "APM",
      organizationId: "org-1",
      managerId: "mgr-1",
      onboardingComplete: true,
      active: true,
    });
    prisma.userProperty.findMany.mockResolvedValue([
      { buildingId: "bld-1" },
      { buildingId: "bld-2" },
    ]);

    await expect(loadFreshAuthUserById("user-2")).resolves.toMatchObject({
      id: "user-2",
      assignedProperties: ["bld-1", "bld-2"],
    });
    expect(prisma.userProperty.findMany).toHaveBeenCalledWith({
      where: { userId: "mgr-1" },
      select: { buildingId: true },
    });
  });
});
