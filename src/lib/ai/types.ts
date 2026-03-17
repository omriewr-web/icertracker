export const AI_TEXT_CONTEXTS = [
  "collection_note",
  "legal_note",
  "work_order_description",
  "work_order_note",
  "violation_note",
  "tenant_note",
  "legal_demand_letter",
  "general",
] as const;

export type TextEnhanceContext = typeof AI_TEXT_CONTEXTS[number];

export interface EnhanceTextRequest {
  text: string;
  context: TextEnhanceContext;
}

export interface EnhanceTextResponse {
  enhanced: string;
  context: TextEnhanceContext;
}
