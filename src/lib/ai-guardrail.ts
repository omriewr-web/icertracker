// AI_GUARDRAIL: AI functions must NEVER directly call prisma.create/update/delete
// on financial models (Tenant, Lease, CollectionCase, LegalCase, Payment).
// They must return AIRecommendation<T> and let the user confirm.

export type AIRecommendation<T> = {
  action: string;
  data: T;
  requiresApproval: true;
  generatedAt: string;
};

export function wrapAIOutput<T>(data: T, action: string): AIRecommendation<T> {
  return {
    action,
    data,
    requiresApproval: true,
    generatedAt: new Date().toISOString(),
  };
}
