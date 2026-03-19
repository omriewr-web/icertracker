// ── Status normalization — canonical source is @/lib/constants/statuses ──
// Re-exported here for backwards compatibility with existing imports.

export {
  normalizeCollectionStatus,
  getCollectionStatusColor as getStatusColor,
} from "@/lib/constants/statuses";

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
