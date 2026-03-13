import { prisma } from "@/lib/prisma";

type RiskCategory = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface RiskFactors {
  violationScore: number;
  vacancyScore: number;
  arrearsScore: number;
  legalScore: number;
  details: {
    openViolations: number;
    classACount: number;
    classBCount: number;
    classCCount: number;
    vacancyRate: number;
    arrearsRatio: number;
    activeLegalCases: number;
  };
}

interface RiskResult {
  buildingId: string;
  riskScore: number;
  riskCategory: RiskCategory;
  factors: RiskFactors;
}

function categorize(score: number): RiskCategory {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

/**
 * Compute a 0–100 risk score for a building.
 *
 * Weights:
 *   Violations  35 pts  (Class C=10, B=5, A=2 each, capped at 35)
 *   Vacancy     25 pts  (vacancy rate × 100, capped at 25)
 *   Arrears     25 pts  (arrears-to-rent ratio × 25, capped at 25)
 *   Legal       15 pts  (3 pts per active case, capped at 15)
 *
 * Persists the score to Building.riskScore/riskCategory and creates a RiskSnapshot.
 */
export async function computeBuildingRiskScore(
  buildingId: string,
): Promise<RiskResult> {
  const [violations, units, tenants, legalCases] = await Promise.all([
    prisma.violation.findMany({
      where: { buildingId, isOpen: true },
      select: { class: true },
    }),
    prisma.unit.findMany({
      where: { buildingId, isResidential: true },
      select: { isVacant: true },
    }),
    prisma.tenant.findMany({
      where: { unit: { buildingId } },
      select: { balance: true, marketRent: true },
    }),
    prisma.legalCase.findMany({
      where: { tenant: { unit: { buildingId } }, isActive: true },
      select: { id: true },
    }),
  ]);

  // Violations
  let classA = 0, classB = 0, classC = 0;
  for (const v of violations) {
    if (v.class === "A") classA++;
    else if (v.class === "B") classB++;
    else if (v.class === "C") classC++;
  }
  const violationScore = Math.min(35, classC * 10 + classB * 5 + classA * 2);

  // Vacancy
  const totalUnits = units.length;
  const vacantCount = units.filter((u) => u.isVacant).length;
  const vacancyRate = totalUnits > 0 ? vacantCount / totalUnits : 0;
  const vacancyScore = Math.min(25, Math.round(vacancyRate * 100));

  // Arrears
  const totalRent = tenants.reduce((s, t) => s + Number(t.marketRent || 0), 0);
  const totalArrears = tenants.reduce((s, t) => s + Math.max(0, Number(t.balance || 0)), 0);
  const arrearsRatio = totalRent > 0 ? totalArrears / totalRent : 0;
  const arrearsScore = Math.min(25, Math.round(arrearsRatio * 25));

  // Legal
  const legalScore = Math.min(15, legalCases.length * 3);

  const riskScore = Math.min(100, violationScore + vacancyScore + arrearsScore + legalScore);
  const riskCategory = categorize(riskScore);

  const factors: RiskFactors = {
    violationScore,
    vacancyScore,
    arrearsScore,
    legalScore,
    details: {
      openViolations: violations.length,
      classACount: classA,
      classBCount: classB,
      classCCount: classC,
      vacancyRate: Math.round(vacancyRate * 1000) / 10,
      arrearsRatio: Math.round(arrearsRatio * 100) / 100,
      activeLegalCases: legalCases.length,
    },
  };

  // Persist
  await prisma.$transaction([
    prisma.building.update({
      where: { id: buildingId },
      data: { riskScore, riskCategory },
    }),
    prisma.riskSnapshot.create({
      data: { buildingId, riskScore, riskCategory, factors: factors as any },
    }),
  ]);

  return { buildingId, riskScore, riskCategory, factors };
}

/**
 * Returns risk score history for a building, most recent first.
 */
export async function getBuildingRiskHistory(
  buildingId: string,
  months: number = 6,
): Promise<{ snapshotDate: Date; riskScore: number; riskCategory: string; factors: any }[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  return prisma.riskSnapshot.findMany({
    where: { buildingId, snapshotDate: { gte: since } },
    select: { snapshotDate: true, riskScore: true, riskCategory: true, factors: true },
    orderBy: { snapshotDate: "desc" },
  });
}
