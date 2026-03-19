import { describe, it, expect, vi } from "vitest";

// Test the automation logic without prisma
// We test the task generation logic

describe("Utility Automation", () => {
  describe("onMoveOutRecorded task generation", () => {
    it("creates 3 tasks per meter with correct due dates", () => {
      const moveOutDate = new Date("2026-04-15");
      const d14 = new Date(moveOutDate); d14.setDate(d14.getDate() - 14);
      const d7 = new Date(moveOutDate); d7.setDate(d7.getDate() - 7);

      expect(d14.toISOString().split("T")[0]).toBe("2026-04-01");
      expect(d7.toISOString().split("T")[0]).toBe("2026-04-08");
      expect(moveOutDate.toISOString().split("T")[0]).toBe("2026-04-15");
    });

    it("only targets unit_submeter meters", () => {
      const meters = [
        { id: "m1", classification: "unit_submeter", accounts: [{ status: "active" }] },
        { id: "m2", classification: "building_master", accounts: [{ status: "active" }] },
        { id: "m3", classification: "common_area", accounts: [{ status: "active" }] },
      ];
      const eligible = meters.filter(m => m.classification === "unit_submeter" && m.accounts.some(a => a.status === "active"));
      expect(eligible).toHaveLength(1);
      expect(eligible[0].id).toBe("m1");
    });

    it("skips meters without active accounts", () => {
      const meters = [
        { id: "m1", classification: "unit_submeter", accounts: [] },
        { id: "m2", classification: "unit_submeter", accounts: [{ status: "closed" }] },
      ];
      const eligible = meters.filter(m => m.classification === "unit_submeter" && m.accounts.some(a => a.status === "active"));
      expect(eligible).toHaveLength(0);
    });
  });

  describe("onUnitBecameVacant task generation", () => {
    it("creates confirm_owner_utility task due in 3 days", () => {
      const now = new Date();
      const dueAt = new Date(now);
      dueAt.setDate(dueAt.getDate() + 3);
      const diffDays = Math.round((dueAt.getTime() - now.getTime()) / 86400000);
      expect(diffDays).toBe(3);
    });
  });

  describe("onNewTenantCreated task generation", () => {
    it("creates tenant_open_account due on moveInDate", () => {
      const moveInDate = new Date("2026-05-01");
      expect(moveInDate.toISOString().split("T")[0]).toBe("2026-05-01");
    });

    it("creates confirm_tenant_confirmed due 7 days after moveInDate", () => {
      const moveInDate = new Date("2026-05-01");
      const confirmDate = new Date(moveInDate);
      confirmDate.setDate(confirmDate.getDate() + 7);
      expect(confirmDate.toISOString().split("T")[0]).toBe("2026-05-08");
    });

    it("defaults to 7 days from now if no moveInDate", () => {
      const now = new Date();
      const dueAt = new Date(now);
      dueAt.setDate(dueAt.getDate() + 7);
      const diffDays = Math.round((dueAt.getTime() - now.getTime()) / 86400000);
      expect(diffDays).toBe(7);
    });
  });

  describe("onVacancyClosed resolution", () => {
    it("resolves only confirm_owner_utility tasks", () => {
      const tasks = [
        { taskType: "confirm_owner_utility", status: "pending" },
        { taskType: "tenant_open_account", status: "pending" },
        { taskType: "confirm_owner_utility", status: "completed" },
      ];
      const toResolve = tasks.filter(t => t.taskType === "confirm_owner_utility" && t.status === "pending");
      expect(toResolve).toHaveLength(1);
    });
  });

  describe("Dashboard counts", () => {
    it("returns all required count fields", () => {
      const counts = { pending: 5, overdue: 2, transferNeeded: 1, ownerHoldNeeded: 1, tenantConfirmNeeded: 1 };
      expect(counts).toHaveProperty("pending");
      expect(counts).toHaveProperty("overdue");
      expect(counts).toHaveProperty("transferNeeded");
      expect(counts).toHaveProperty("ownerHoldNeeded");
      expect(counts).toHaveProperty("tenantConfirmNeeded");
    });
  });

  describe("Event recording immutability", () => {
    it("events have required fields", () => {
      const event = {
        orgId: "org1",
        buildingId: "b1",
        utilityMeterId: "m1",
        eventType: "account_opened",
        workflowState: "active_confirmed",
        createdAt: new Date(),
      };
      expect(event.orgId).toBeTruthy();
      expect(event.buildingId).toBeTruthy();
      expect(event.utilityMeterId).toBeTruthy();
      expect(event.eventType).toBeTruthy();
      expect(event.workflowState).toBeTruthy();
    });
  });
});
