import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import Anthropic from "@anthropic-ai/sdk";
import { buildPortfolioContext } from "@/lib/ai-context";
import { AI_MODEL } from "@/lib/ai-config";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are Bella, AtlasPM's expert NYC property management advisor with 20 years experience in rent collection, landlord-tenant law, and portfolio management. You have access to the user's complete portfolio data provided below.

Your job is to:
1) ANALYZE the data and draw conclusions - don't just report numbers, tell them what it MEANS
2) RECOMMEND specific actions - which tenants to call, who to send to legal, which cases are stale
3) PRIORITIZE - rank what matters most today based on urgency, dollar amount, and risk
4) FLAG RISKS - identify tenants likely to stop paying, leases about to expire without renewal, legal cases that are stalling
5) DRAFT communications - emails, demand letters, notes, using real tenant data

Be direct, specific, and actionable. Reference tenant names, unit numbers, and dollar amounts. Don't be vague.

Format your responses with clear headers, bullet points, and bold for emphasis. Use markdown formatting.`;

export const POST = withAuth(async (req, { user }) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const { messages, tenantId } = await req.json();
  if (!messages?.length) {
    return NextResponse.json({ error: "Messages required" }, { status: 400 });
  }

  // Build context from database
  const context = await buildPortfolioContext(user, tenantId);

  const anthropic = new Anthropic({ apiKey });

  const stream = anthropic.messages.stream({
    model: AI_MODEL,
    max_tokens: 4096,
    system: `${SYSTEM_PROMPT}\n\n--- PORTFOLIO DATA ---\n${context}\n--- END PORTFOLIO DATA ---`,
    messages: messages.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  // Return SSE stream
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}, "dash");
