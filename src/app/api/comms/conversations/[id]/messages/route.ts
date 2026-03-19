import { NextRequest, NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { listMessages, sendMessage } from "@/lib/comms/message.service";
import { markConversationRead } from "@/lib/comms/conversation.service";
import { messageCreateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") || undefined;
  const limit = parseInt(searchParams.get("limit") || "50", 10) || 50;

  const messages = await listMessages({
    conversationId: id,
    userId: user.id,
    orgId: user.organizationId!,
    cursor,
    limit,
  });

  return NextResponse.json({ messages });
}, "dash");

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const body = await parseBody(req, messageCreateSchema);

  const message = await sendMessage({
    conversationId: id,
    senderUserId: user.id,
    orgId: user.organizationId!,
    body: body.body.trim(),
    messageType: body.messageType || "standard",
    replyToMessageId: body.replyToMessageId ?? undefined,
    mentionedUserIds: body.mentionedUserIds || [],
    metadata: body.metadata ?? undefined as Record<string, unknown> | undefined,
  });

  await markConversationRead(id, user.id, message.id);

  return NextResponse.json({ message }, { status: 201 });
}, "dash");
