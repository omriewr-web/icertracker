// AI_GUARDRAIL: This service returns recommendations only.
// It must never directly mutate financial records.
import { prisma } from "@/lib/prisma";
import { demandLetter, lateNotice, type EmailContext } from "@/lib/email-templates";

// ── Trade classification for work orders ──────────────────────

const TRADE_KEYWORDS: Record<string, string[]> = {
  PLUMBING: ["plumb", "pipe", "leak", "water", "drain", "faucet", "toilet", "boiler", "hot water", "sewage"],
  ELECTRICAL: ["electri", "wiring", "outlet", "circuit", "light", "power", "switch", "panel"],
  HVAC: ["heat", "hvac", "air condition", "radiator", "thermostat", "furnace", "ventilation", "ac unit"],
  CARPENTRY: ["door", "window", "floor", "cabinet", "shelf", "frame", "wood", "tile", "ceiling"],
  PAINTING: ["paint", "wall", "plaster", "drywall", "stain", "patch"],
  PEST_CONTROL: ["pest", "roach", "mouse", "mice", "rat", "bed bug", "bedbug", "insect", "exterminator"],
  ELEVATOR: ["elevator", "lift"],
  FIRE_SAFETY: ["fire", "smoke detector", "sprinkler", "alarm", "extinguisher", "carbon monoxide"],
  GENERAL: [],
};

/**
 * Suggest a trade classification from a work order description.
 * Returns the best-matching trade or "GENERAL" if no strong match.
 */
export function triageWorkOrderTrade(description: string): string {
  const lower = description.toLowerCase();
  let bestTrade = "GENERAL";
  let bestCount = 0;

  for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
    if (trade === "GENERAL") continue;
    const matches = keywords.filter((kw) => lower.includes(kw)).length;
    if (matches > bestCount) {
      bestCount = matches;
      bestTrade = trade;
    }
  }

  return bestTrade;
}

// ── Delinquency notice drafting ──────────────────────────────

interface DelinquencyNotice {
  templateUsed: "demand-letter" | "late-notice";
  subject: string;
  body: string;
}

/**
 * Builds a delinquency notice for a tenant.
 * Uses demand letter (>= 60 days) or late notice (>= 30 days).
 */
export async function draftDelinquencyNotice(
  tenantId: string,
  managerName: string,
  opts?: { managerPhone?: string; managerEmail?: string; companyName?: string },
): Promise<DelinquencyNotice | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      balance: true,
      marketRent: true,
      leaseExpiration: true,
      unit: {
        select: {
          unitNumber: true,
          building: { select: { address: true } },
        },
      },
    },
  });

  if (!tenant?.unit) return null;

  const balance = Number(tenant.balance);
  const marketRent = Number(tenant.marketRent);
  if (balance <= 0 || marketRent <= 0) return null;

  const monthsOwed = balance / marketRent;
  const arrearsDays = Math.round(monthsOwed * 30);

  const ctx: EmailContext = {
    tenantName: tenant.name,
    unitNumber: tenant.unit.unitNumber,
    buildingAddress: tenant.unit.building?.address ?? "",
    balance,
    monthsOwed,
    arrearsDays,
    marketRent,
    leaseExpiration: tenant.leaseExpiration?.toISOString() ?? null,
    managerName,
    managerPhone: opts?.managerPhone,
    managerEmail: opts?.managerEmail,
    companyName: opts?.companyName,
  };

  // >= 2 months: formal demand, otherwise late notice
  if (monthsOwed >= 2) {
    const result = demandLetter(ctx);
    return { templateUsed: "demand-letter", ...result };
  }
  const result = lateNotice(ctx);
  return { templateUsed: "late-notice", ...result };
}

// ── DHCR overcharge risk detection ───────────────────────────

interface OverchargeRisk {
  leaseId: string;
  tenantId: string;
  tenantName: string;
  unitNumber: string;
  buildingAddress: string;
  legalRent: number;
  preferentialRent: number;
  monthlyRent: number;
  riskType: "above-legal" | "pref-gap" | "both";
  explanation: string;
}

/**
 * Check if a stabilized lease has potential DHCR overcharge risk.
 * Flags:
 *   - monthlyRent > legalRent (charging above legal maximum)
 *   - Large gap between legalRent and preferentialRent without documentation
 */
export async function flagDhcrOverchargeRisk(
  leaseId: string,
): Promise<OverchargeRisk | null> {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    select: {
      id: true,
      tenantId: true,
      monthlyRent: true,
      legalRent: true,
      preferentialRent: true,
      isStabilized: true,
      tenant: {
        select: {
          name: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { address: true } },
            },
          },
        },
      },
    },
  });

  if (!lease || !lease.isStabilized) return null;

  const monthlyRent = Number(lease.monthlyRent) || 0;
  const legalRent = Number(lease.legalRent) || 0;
  const prefRent = Number(lease.preferentialRent) || 0;

  if (legalRent <= 0) return null; // Can't assess without legal rent

  const aboveLegal = monthlyRent > legalRent;
  const largePrefGap = prefRent > 0 && legalRent > 0 && (legalRent - prefRent) / legalRent > 0.2;

  if (!aboveLegal && !largePrefGap) return null;

  let riskType: OverchargeRisk["riskType"];
  let explanation: string;

  if (aboveLegal && largePrefGap) {
    riskType = "both";
    explanation = `Monthly rent ($${monthlyRent}) exceeds legal rent ($${legalRent}), and preferential rent ($${prefRent}) is >20% below legal rent. Review DHCR registration for compliance.`;
  } else if (aboveLegal) {
    riskType = "above-legal";
    explanation = `Monthly rent ($${monthlyRent}) exceeds legal rent ($${legalRent}). This may constitute an overcharge under rent stabilization law.`;
  } else {
    riskType = "pref-gap";
    explanation = `Preferential rent ($${prefRent}) is >20% below legal rent ($${legalRent}). Verify that the preferential rent rider is properly documented and filed.`;
  }

  return {
    leaseId: lease.id,
    tenantId: lease.tenantId ?? "",
    tenantName: lease.tenant?.name ?? "Unknown",
    unitNumber: lease.tenant?.unit?.unitNumber ?? "",
    buildingAddress: lease.tenant?.unit?.building?.address ?? "",
    legalRent,
    preferentialRent: prefRent,
    monthlyRent,
    riskType,
    explanation,
  };
}
