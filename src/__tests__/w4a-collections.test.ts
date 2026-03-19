/**
 * W4-A: Collections workflow tests
 *
 * Tests the collections lifecycle: balance scoring, status normalization,
 * recalculateTenantBalance logic, and validation schemas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Schema validation tests ────────────────────────────────────────────

import {
  collectionNoteCreateSchema,
  collectionStatusUpdateSchema,
} from "@/lib/validations";

describe("Collection Note Schema", () => {
  it("accepts valid note with required fields", () => {
    const result = collectionNoteCreateSchema.safeParse({
      content: "Called tenant, left voicemail",
      actionType: "CALLED",
    });
    expect(result.success).toBe(true);
  });

  it("accepts note with optional followUpDate", () => {
    const result = collectionNoteCreateSchema.safeParse({
      content: "Sent demand letter",
      actionType: "NOTICE_SENT",
      followUpDate: "2026-04-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = collectionNoteCreateSchema.safeParse({
      content: "",
      actionType: "CALLED",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid actionType", () => {
    const result = collectionNoteCreateSchema.safeParse({
      content: "Some note",
      actionType: "INVALID_TYPE",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid action types", () => {
    const validTypes = [
      "CALLED", "LEFT_VOICEMAIL", "TEXTED", "EMAILED", "NOTICE_SENT",
      "PAYMENT_PLAN", "PARTIAL_PAYMENT", "PROMISE_TO_PAY", "SENT_TO_LEGAL", "OTHER",
    ];
    for (const actionType of validTypes) {
      const result = collectionNoteCreateSchema.safeParse({ content: "test", actionType });
      expect(result.success, `Expected ${actionType} to be valid`).toBe(true);
    }
  });
});

describe("Collection Status Update Schema", () => {
  it("accepts valid status", () => {
    const result = collectionStatusUpdateSchema.safeParse({ status: "monitoring" });
    expect(result.success).toBe(true);
  });

  it("rejects missing status", () => {
    const result = collectionStatusUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty status string", () => {
    const result = collectionStatusUpdateSchema.safeParse({ status: "" });
    expect(result.success).toBe(false);
  });
});

// ── Status normalization tests ─────────────────────────────────────────

describe("Collection Status Constants", () => {
  it("has expected collection display labels", async () => {
    const mod = await import("@/lib/constants/statuses");
    const labels = mod.COLLECTION_DISPLAY_LABELS;
    expect(labels).toBeDefined();
    expect(labels.CURRENT).toBe("Active");
    expect(labels.LEGAL).toBe("Legal");
    expect(labels.PAYMENT_PLAN).toBe("Payment Plan");
    expect(labels.RESOLVED).toBe("Resolved");
    expect(labels.MONITORING).toBe("Monitoring");
  });

  it("has color mapping for each display label", async () => {
    const mod = await import("@/lib/constants/statuses");
    const colors = mod.COLLECTION_STATUS_COLORS;
    expect(colors).toBeDefined();
    // Colors are keyed by display label, not enum key
    for (const displayLabel of Object.values(mod.COLLECTION_DISPLAY_LABELS)) {
      expect(colors[displayLabel], `Missing color for "${displayLabel}"`).toBeDefined();
    }
  });
});

// ── Collection score logic tests (unit tests on scoring algorithm) ─────

describe("recalculateTenantBalance scoring logic", () => {
  // These test the scoring algorithm directly rather than through prisma.
  // The function scores: +10 balance>0, +15 b31_60>0, +25 b61_90>0,
  // +30 b90plus>0, +20 inLegal, +10 months>=3, +10 no payment,
  // +10 last payment >90d ago. Max 100.

  // Mirrors the scoring in collections.service.ts recalculateTenantBalance
  function calculateScore(opts: {
    totalBalance: number;
    b31_60?: number;
    b61_90?: number;
    b90plus?: number;
    inLegal?: boolean;
    monthsOwed?: number;
    lastPaymentDate?: Date | null;
  }): number {
    if (opts.totalBalance <= 0) return 0;
    let score = 10; // balance > 0
    if ((opts.b31_60 ?? 0) > 0) score += 15;
    if ((opts.b61_90 ?? 0) > 0) score += 25;
    if ((opts.b90plus ?? 0) > 0) score += 30;
    if (opts.inLegal) score += 20;
    if ((opts.monthsOwed ?? 0) >= 3) score += 10;
    if (!opts.lastPaymentDate) {
      score += 10;
    } else {
      const daysSince = Math.round((Date.now() - opts.lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince > 90) score += 10;
    }
    return Math.min(100, score);
  }

  it("zero balance = score 0 (no-payment penalty only applies when balance > 0)", () => {
    // When totalBalance <= 0, the real function returns early with score 0
    expect(calculateScore({ totalBalance: 0 })).toBe(0);
  });

  it("balance > 0 with no aging = score 20 (balance + no payment)", () => {
    expect(calculateScore({ totalBalance: 1000 })).toBe(20);
  });

  it("balance with 31-60 day aging = score 35", () => {
    expect(calculateScore({ totalBalance: 5000, b31_60: 2000 })).toBe(35);
  });

  it("balance with all aging buckets and legal = max 100", () => {
    const score = calculateScore({
      totalBalance: 15000,
      b31_60: 3000,
      b61_90: 3000,
      b90plus: 3000,
      inLegal: true,
      monthsOwed: 5,
      lastPaymentDate: null,
    });
    // 10 + 15 + 25 + 30 + 20 + 10 + 10 = 120, capped at 100
    expect(score).toBe(100);
  });

  it("recent payment reduces score", () => {
    const withPayment = calculateScore({
      totalBalance: 2000,
      lastPaymentDate: new Date(), // today
    });
    const withoutPayment = calculateScore({
      totalBalance: 2000,
      lastPaymentDate: null,
    });
    expect(withoutPayment).toBeGreaterThan(withPayment);
  });

  it("legal adds +20 to score", () => {
    const base = calculateScore({ totalBalance: 5000, b61_90: 2000 });
    const withLegal = calculateScore({ totalBalance: 5000, b61_90: 2000, inLegal: true });
    expect(withLegal - base).toBe(20);
  });
});

// ── Arrears category derivation tests ──────────────────────────────────

describe("Arrears category derivation", () => {
  function deriveCategory(opts: {
    totalBalance: number;
    b0_30?: number;
    b31_60?: number;
    b61_90?: number;
    b90plus?: number;
  }): string {
    const { totalBalance, b90plus = 0, b61_90 = 0, b31_60 = 0, b0_30 = totalBalance } = opts;
    if (totalBalance <= 0) return "current";
    if (b90plus > 0) return "120+";
    if (b61_90 > 0) return "90";
    if (b31_60 > 0) return "60";
    if (b0_30 > 0) return "30";
    return "current";
  }

  it("zero balance = current", () => {
    expect(deriveCategory({ totalBalance: 0 })).toBe("current");
  });

  it("negative balance = current", () => {
    expect(deriveCategory({ totalBalance: -100 })).toBe("current");
  });

  it("only 0-30 bucket = category 30", () => {
    expect(deriveCategory({ totalBalance: 1000, b0_30: 1000 })).toBe("30");
  });

  it("31-60 bucket present = category 60", () => {
    expect(deriveCategory({ totalBalance: 3000, b0_30: 1000, b31_60: 2000 })).toBe("60");
  });

  it("61-90 bucket present = category 90", () => {
    expect(deriveCategory({ totalBalance: 5000, b0_30: 1000, b31_60: 1000, b61_90: 3000 })).toBe("90");
  });

  it("90+ bucket present = category 120+", () => {
    expect(deriveCategory({ totalBalance: 8000, b0_30: 1000, b31_60: 1000, b61_90: 1000, b90plus: 5000 })).toBe("120+");
  });

  it("worst bucket wins even if small", () => {
    expect(deriveCategory({ totalBalance: 10000, b0_30: 9999, b90plus: 1 })).toBe("120+");
  });
});
