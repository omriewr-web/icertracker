// ── Unified status normalization ──

export function normalizeCollectionStatus(status: string, arrearsDays?: number): string {
  // ARSnapshot statuses
  if (status === "CURRENT" || status === "LATE") return "Active";
  if (status === "DELINQUENT") {
    if (arrearsDays != null && arrearsDays < 30) return "Late";
    if (arrearsDays != null && arrearsDays >= 30 && arrearsDays < 60) return "Follow Up";
    if (arrearsDays != null && arrearsDays >= 60 && arrearsDays < 90) return "Legal Review";
    if (arrearsDays != null && arrearsDays >= 90) return "Escalated";
    return "Delinquent";
  }
  if (status === "CHRONIC") return "Escalated";

  // CollectionCase statuses
  if (status === "demand_sent") return "Legal Review";
  if (status === "legal_referred") return "Legal";
  if (status === "monitoring") return "Monitoring";
  if (status === "payment_plan") return "Payment Plan";
  if (status === "resolved") return "Resolved";

  // DB enum statuses (uppercase)
  if (status === "PAYMENT_PLAN") return "Payment Plan";
  if (status === "LEGAL") return "Legal";
  if (status === "HARDSHIP") return "Hardship";
  if (status === "WRITTEN_OFF") return "Written Off";
  if (status === "VACATE_PENDING") return "Vacate Pending";

  // Fallback
  return status.replace(/_/g, " ");
}

export function getStatusColor(displayLabel: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    "Active": { bg: "bg-green-500/10", text: "text-green-400" },
    "Late": { bg: "bg-yellow-500/10", text: "text-yellow-400" },
    "Follow Up": { bg: "bg-orange-500/10", text: "text-orange-400" },
    "Delinquent": { bg: "bg-orange-500/10", text: "text-orange-400" },
    "Legal Review": { bg: "bg-red-500/10", text: "text-red-300" },
    "Escalated": { bg: "bg-red-500/10", text: "text-red-400" },
    "Legal": { bg: "bg-purple-500/10", text: "text-purple-400" },
    "Monitoring": { bg: "bg-blue-500/10", text: "text-blue-400" },
    "Payment Plan": { bg: "bg-blue-500/10", text: "text-blue-400" },
    "Resolved": { bg: "bg-green-500/10", text: "text-green-400" },
    "Hardship": { bg: "bg-sky-500/10", text: "text-sky-400" },
    "Written Off": { bg: "bg-gray-500/10", text: "text-gray-400" },
    "Vacate Pending": { bg: "bg-gray-500/10", text: "text-gray-400" },
  };
  return map[displayLabel] ?? { bg: "bg-gray-500/10", text: "text-gray-400" };
}

/** Atlas AI recommendation for a tenant collection profile */
export interface AIRecommendation {
  title: string;
  explanation: string;
  urgency: "High" | "Medium" | "Low";
}

export interface AIRecommendResponse {
  recommendations: AIRecommendation[];
  generatedAt: string;
  tenantName: string;
  totalBalance: number;
}

export interface AIRecommendFallbackResponse {
  fallback: string;
  generatedAt: string;
}

/** AR Report types */

export interface ARAgingBuildingRow {
  buildingId: string;
  buildingAddress: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days120: number;
  total: number;
  pctOfAR: number;
}

export interface ARTenantDetailRow {
  tenantId: string;
  tenantName: string;
  buildingAddress: string;
  unit: string;
  balance: number;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days120: number;
  status: string;
  daysSinceNote: number | null;
  lastNote: string | null;
}

export interface ARReportData {
  generatedAt: string;
  period: { month: string; year: number };
  summary: {
    totalBalance: number;
    tenantCount: number;
    avgDaysOutstanding: number;
    largestBalance: number;
  };
  agingByBuilding: ARAgingBuildingRow[];
  tenants: ARTenantDetailRow[];
  activity: {
    notesByType: Record<string, number>;
    statusChanges: number;
    top5ByBalance: Array<{ tenantName: string; balance: number; lastNoteDate: string | null }>;
  };
}
