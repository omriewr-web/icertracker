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
