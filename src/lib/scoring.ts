// AtlasPM - Collection Score Algorithm (0-100 priority)

export interface ScoreInput {
  balance: number;
  marketRent: number;
  arrearsDays: number;
  leaseStatus: string;
  legalFlag: boolean;
  legalRecommended: boolean;
  isVacant: boolean;
}

export function calcCollectionScore(t: ScoreInput): number {
  if (t.isVacant || !t.balance || t.balance <= 0) return 0;
  let score = 0;

  // Balance weight (up to 35 pts)
  const balRatio = Math.min(t.balance / (t.marketRent || 1), 6);
  score += Math.min(35, Math.round(balRatio * 5.8));

  // Days delinquent (up to 30 pts)
  score += Math.min(30, Math.round(t.arrearsDays * 0.25));

  // Absolute dollar amount (up to 15 pts)
  if (t.balance >= 20000) score += 15;
  else if (t.balance >= 10000) score += 12;
  else if (t.balance >= 5000) score += 8;
  else if (t.balance >= 2000) score += 4;

  // Lease risk (up to 10 pts)
  if (t.leaseStatus === "expired") score += 10;
  else if (t.leaseStatus === "expiring-soon") score += 5;
  else if (t.leaseStatus === "no-lease") score += 8;

  // Legal status (up to 10 pts)
  if (t.legalRecommended && !t.legalFlag) score += 10;
  else if (t.legalFlag) score += 3;

  return Math.min(100, score);
}

export function getArrearsCategory(balance: number, marketRent: number): string {
  if (!balance || balance <= 0 || !marketRent || marketRent <= 0) return "current";
  const months = balance / marketRent;
  if (months >= 4) return "120+";
  if (months >= 3) return "90";
  if (months >= 2) return "60";
  if (months >= 1) return "30";
  return "current";
}

export function getArrearsDays(balance: number, marketRent: number): number {
  if (!balance || balance <= 0 || !marketRent || marketRent <= 0) return 0;
  return Math.round((balance / marketRent) * 30);
}

export function getLeaseStatus(leaseExpiration: Date | null): string {
  if (!leaseExpiration) return "no-lease";
  const now = new Date();
  const days = Math.floor((leaseExpiration.getTime() - now.getTime()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 90) return "expiring-soon";
  return "active";
}

export function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "CRITICAL", color: "#EF4444" };
  if (score >= 60) return { label: "HIGH", color: "#F97316" };
  if (score >= 40) return { label: "MEDIUM", color: "#F59E0B" };
  if (score >= 20) return { label: "LOW", color: "#3B82F6" };
  return { label: "OK", color: "#10B981" };
}