import { NextResponse } from "next/server";
import logger from "@/lib/logger";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { AI_MODEL } from "@/lib/ai-config";
import { enhanceTextSchema } from "@/lib/validations";
import type { TextEnhanceContext } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPTS: Record<TextEnhanceContext, string> = {
  collection_note: "You are a professional property management collections assistant. Rewrite the following collection note to be clear, concise, and professional. Maintain all factual details. Use property management terminology. Return ONLY the enhanced text, no explanation.",
  legal_note: "You are a legal assistant for a NYC property management firm. Rewrite the following legal case note to be precise, professional, and legally appropriate. Maintain all factual details and dates. Return ONLY the enhanced text.",
  work_order_description: "You are a property maintenance coordinator. Rewrite the following work order description to be clear, specific, and actionable. Include relevant details about location, issue, and urgency. Return ONLY the enhanced text.",
  work_order_note: "You are a property maintenance coordinator. Rewrite the following work order update note to be clear and professional. Maintain all factual details. Return ONLY the enhanced text.",
  violation_note: "You are a NYC building compliance specialist. Rewrite the following violation note to be clear, factual, and compliance-focused. Reference any relevant NYC building codes if applicable. Return ONLY the enhanced text.",
  tenant_note: "You are a professional property manager. Rewrite the following tenant note to be clear, professional, and factual. Remove informal language while maintaining all important details. Return ONLY the enhanced text.",
  legal_demand_letter: "You are a legal assistant for a NYC property management firm specializing in landlord-tenant law. Rewrite the following demand letter text to be professional, legally sound, and appropriately firm. Maintain all factual details, dates, and amounts. Reference relevant NYC housing law where appropriate. Return ONLY the enhanced text.",
  general: "You are a professional writing assistant for a property management company. Rewrite the following text to be clear, concise, and professional. Maintain all factual details. Return ONLY the enhanced text.",
};

export const POST = withAuth(async (req) => {
  const data = await parseBody(req, enhanceTextSchema);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Enhancement unavailable" }, { status: 503 });
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPTS[data.context as TextEnhanceContext],
      messages: [{ role: "user", content: data.text }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Enhancement unavailable" }, { status: 503 });
    }

    return NextResponse.json({ enhanced: textBlock.text.trim(), context: data.context });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err: msg }, "[AI Enhance] Error");
    return NextResponse.json({ error: "Enhancement unavailable" }, { status: 503 });
  }
}, "dash");
