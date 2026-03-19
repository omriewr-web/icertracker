import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { markConversationRead } from "@/lib/comms/conversation.service";

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const body = await req.json();

  if (!body.lastMessageId) {
    return NextResponse.json({ error: "lastMessageId required" }, { status: 400 });
  }

  await markConversationRead(id, user.id, body.lastMessageId);
  return NextResponse.json({ success: true });
}, "dash");
