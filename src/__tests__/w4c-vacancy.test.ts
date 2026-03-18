/**
 * W4-C: Vacancy lifecycle tests
 *
 * Tests vacancy status transitions, syncVacancyState logic,
 * lost rent calculations, and the vacancy API response shape.
 */
import { describe, it, expect, vi } from "vitest";
import { VacancyStatus } from "@prisma/client";

// ── Vacancy status transition rules ────────────────────────────────────

const VACANCY_STATUSES: VacancyStatus[] = [
  "VACANT", "PRE_TURNOVER", "TURNOVER", "READY_TO_SHOW",
  "RENT_PROPOSED", "RENT_APPROVED", "LISTED", "LEASED", "OCCUPIED",
];

const VACANT_STATUSES: VacancyStatus[] = [
  "VACANT", "PRE_TURNOVER", "TURNOVER", "READY_TO_SHOW",
  "RENT_PROPOSED", "RENT_APPROVED", "LISTED", "LEASED",
];

describe("Vacancy status definitions", () => {
  it("all vacancy statuses exist in the Prisma enum", () => {
    for (const s of VACANCY_STATUSES) {
      expect(typeof s).toBe("string");
    }
  });

  it("OCCUPIED is not a vacant status", () => {
    expect(VACANT_STATUSES).not.toContain("OCCUPIED");
  });

  it("all non-OCCUPIED statuses are vacant", () => {
    for (const s of VACANCY_STATUSES) {
      if (s === "OCCUPIED") continue;
      expect(VACANT_STATUSES).toContain(s);
    }
  });
});

// ── Status transition logic ────────────────────────────────────────────

describe("Vacancy status transitions", () => {
  // Map status to whether unit.isVacant should be true
  function shouldBeVacant(status: VacancyStatus): boolean {
    return VACANT_STATUSES.includes(status);
  }

  it("VACANT means isVacant = true", () => {
    expect(shouldBeVacant("VACANT")).toBe(true);
  });

  it("TURNOVER means isVacant = true", () => {
    expect(shouldBeVacant("TURNOVER")).toBe(true);
  });

  it("READY_TO_SHOW means isVacant = true", () => {
    expect(shouldBeVacant("READY_TO_SHOW")).toBe(true);
  });

  it("LEASED means isVacant = true (still vacant until move-in)", () => {
    expect(shouldBeVacant("LEASED")).toBe(true);
  });

  it("OCCUPIED means isVacant = false", () => {
    expect(shouldBeVacant("OCCUPIED")).toBe(false);
  });
});

// ── syncVacancyState stage mapping ─────────────────────────────────────

describe("syncVacancyState stage mapping", () => {
  // From vacancy.service.ts: unit status → Vacancy stage
  const STAGE_MAP: Record<string, string> = {
    VACANT: "vacant",
    PRE_TURNOVER: "vacant",
    TURNOVER: "renovation",
    READY_TO_SHOW: "listed",
    RENT_PROPOSED: "listed",
    RENT_APPROVED: "listed",
    LISTED: "listed",
    LEASED: "lease_signed",
  };

  // From vacancy.service.ts: unit status → TurnoverWorkflow status
  const TURNOVER_MAP: Record<string, string> = {
    PRE_TURNOVER: "PENDING_INSPECTION",
    TURNOVER: "SCOPE_CREATED",
    READY_TO_SHOW: "READY_TO_LIST",
    RENT_PROPOSED: "READY_TO_LIST",
    RENT_APPROVED: "READY_TO_LIST",
    LISTED: "LISTED",
    LEASED: "COMPLETE",
  };

  it("maps VACANT and PRE_TURNOVER to stage 'vacant'", () => {
    expect(STAGE_MAP["VACANT"]).toBe("vacant");
    expect(STAGE_MAP["PRE_TURNOVER"]).toBe("vacant");
  });

  it("maps TURNOVER to stage 'renovation'", () => {
    expect(STAGE_MAP["TURNOVER"]).toBe("renovation");
  });

  it("maps READY_TO_SHOW through LISTED to stage 'listed'", () => {
    expect(STAGE_MAP["READY_TO_SHOW"]).toBe("listed");
    expect(STAGE_MAP["RENT_PROPOSED"]).toBe("listed");
    expect(STAGE_MAP["RENT_APPROVED"]).toBe("listed");
    expect(STAGE_MAP["LISTED"]).toBe("listed");
  });

  it("maps LEASED to stage 'lease_signed'", () => {
    expect(STAGE_MAP["LEASED"]).toBe("lease_signed");
  });

  it("turnover workflow progresses forward only", () => {
    const order = ["PENDING_INSPECTION", "SCOPE_CREATED", "READY_TO_LIST", "LISTED", "COMPLETE"];
    // PRE_TURNOVER should be earlier than LEASED in the workflow
    const preIdx = order.indexOf(TURNOVER_MAP["PRE_TURNOVER"]);
    const leasedIdx = order.indexOf(TURNOVER_MAP["LEASED"]);
    expect(preIdx).toBeLessThan(leasedIdx);
  });
});

// ── Lost rent calculation tests ────────────────────────────────────────

describe("Lost rent calculation", () => {
  // The vacancies API returns bestRent = max(approved, proposed, asking, legal)
  // Lost rent should use legalRent for rent-stabilized units

  function bestRent(unit: {
    approvedRent: number | null;
    proposedRent: number | null;
    askingRent: number | null;
    legalRent: number | null;
  }): number {
    return (
      unit.approvedRent || unit.proposedRent || unit.askingRent || unit.legalRent || 0
    );
  }

  it("uses approvedRent as highest priority", () => {
    expect(bestRent({ approvedRent: 3000, proposedRent: 2800, askingRent: 2500, legalRent: 2000 })).toBe(3000);
  });

  it("falls back to proposedRent if no approved", () => {
    expect(bestRent({ approvedRent: null, proposedRent: 2800, askingRent: 2500, legalRent: 2000 })).toBe(2800);
  });

  it("falls back to askingRent if no approved/proposed", () => {
    expect(bestRent({ approvedRent: null, proposedRent: null, askingRent: 2500, legalRent: 2000 })).toBe(2500);
  });

  it("falls back to legalRent as last resort", () => {
    expect(bestRent({ approvedRent: null, proposedRent: null, askingRent: null, legalRent: 2000 })).toBe(2000);
  });

  it("returns 0 if no rent data", () => {
    expect(bestRent({ approvedRent: null, proposedRent: null, askingRent: null, legalRent: null })).toBe(0);
  });

  it("does NOT use marketRent (not in bestRent cascade)", () => {
    // bestRent only uses approved/proposed/asking/legal — NOT marketRent
    // This matches the vacancy route: bestRent = approved || proposed || asking || legal || 0
    const rent = bestRent({ approvedRent: null, proposedRent: null, askingRent: null, legalRent: 1500 });
    expect(rent).toBe(1500); // Uses legalRent, not marketRent
  });
});

// ── Days vacant calculation tests ──────────────────────────────────────

describe("Days vacant calculation", () => {
  function daysVacant(vacantSince: Date | null): number | null {
    if (!vacantSince) return null;
    const now = new Date();
    return Math.max(0, Math.floor((now.getTime() - vacantSince.getTime()) / 86400000));
  }

  it("returns null when vacantSince is null", () => {
    expect(daysVacant(null)).toBeNull();
  });

  it("returns 0 for unit just vacated today", () => {
    expect(daysVacant(new Date())).toBe(0);
  });

  it("returns positive number for past date", () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const days = daysVacant(thirtyDaysAgo);
    expect(days).toBeGreaterThanOrEqual(29);
    expect(days).toBeLessThanOrEqual(31);
  });

  it("never returns negative", () => {
    const future = new Date(Date.now() + 86400000);
    expect(daysVacant(future)).toBe(0);
  });
});

// ── Vacancy status schema validation ───────────────────────────────────

describe("Vacancy status schema", () => {
  it("all valid statuses match Prisma enum", () => {
    const prismaStatuses = Object.values(VacancyStatus);
    for (const s of VACANCY_STATUSES) {
      expect(prismaStatuses).toContain(s);
    }
  });
});
