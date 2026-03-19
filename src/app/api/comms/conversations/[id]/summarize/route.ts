import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL } from "@/lib/ai-config";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;

  // Verify membership
  const member = await prisma.conversationMember.findFirst({
    where: {
      conversationId: id,
      userId: user.id,
      leftAt: null,
      conversation: { orgId: user.organizationId! },
    },
  });
  if (!member) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  // Fetch conversation + recent messages
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: {
      title: true,
      type: true,
      relatedEntityType: true,
      relatedEntityId: true,
    },
  });

  const messages = await prisma.message.findMany({
    where: { conversationId: id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      body: true,
      senderUserId: true,
      createdAt: true,
      isSystemGenerated: true,
      messageType: true,
    },
  });

  if (messages.length === 0) {
    return NextResponse.json({ summary: "No messages to summarize." });
  }

  // Resolve sender names
  const senderIds = new Set(messages.filter((m) => m.senderUserId).map((m) => m.senderUserId!));
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(senderIds) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u.name]));

  const transcript = messages
    .reverse()
    .map((m) => {
      const sender = m.isSystemGenerated
        ? "[System]"
        : m.senderUserId
          ? nameMap.get(m.senderUserId) ?? "Unknown"
          : "[System]";
      const date = new Date(m.createdAt).toLocaleDateString();
      const tag = m.messageType !== "standard" ? ` [${m.messageType.toUpperCase()}]` : "";
      return `${date} ${sender}${tag}: ${m.body}`;
    })
    .join("\n");

  const contextLine = conversation?.relatedEntityType
    ? `This conversation is about a ${conversation.relatedEntityType.replace(/_/g, " ")}.`
    : "";

  const client = new Anthropic();
  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are summarizing an internal property management team conversation.
${contextLine}
Title: ${conversation?.title ?? "Untitled"}

Provide a 2-4 sentence summary covering: key decisions, open items, and who committed to what. Be factual and direct.

Transcript:
${transcript}`,
      },
    ],
  });

  const summary =
    response.content[0].type === "text"
      ? response.content[0].text
      : "Unable to generate summary.";

  return NextResponse.json({ summary });
}, "dash");
