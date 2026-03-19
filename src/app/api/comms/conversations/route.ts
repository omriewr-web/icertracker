import { NextRequest, NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api-helpers";
import {
  listUserConversations,
  createGroupConversation,
  getOrCreateDirectConversation,
} from "@/lib/comms/conversation.service";
import { conversationCreateSchema } from "@/lib/validations";
import type { ConversationType } from "@prisma/client";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as ConversationType | null;
  const isArchived = searchParams.get("archived") === "true";

  const conversations = await listUserConversations(
    user.organizationId!,
    user.id,
    { type: type || undefined, isArchived }
  );

  return NextResponse.json({ conversations });
}, "dash");

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, conversationCreateSchema);

  if (body.type === "direct") {
    if (!body.targetUserId) {
      return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
    }
    const conversation = await getOrCreateDirectConversation(
      user.organizationId!,
      user.id,
      body.targetUserId
    );
    return NextResponse.json({ conversation });
  }

  if (body.type === "group") {
    if (!body.title) {
      return NextResponse.json({ error: "title required for group" }, { status: 400 });
    }
    const conversation = await createGroupConversation(
      user.organizationId!,
      user.id,
      body.title,
      body.memberIds ?? [],
      body.relatedEntityType ?? undefined,
      body.relatedEntityId ?? undefined,
      body.buildingId ?? undefined
    );
    return NextResponse.json({ conversation });
  }

  return NextResponse.json({ error: "Invalid conversation type" }, { status: 400 });
}, "dash");
