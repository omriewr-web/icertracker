import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import {
  getConversationDetail,
  archiveConversation,
  setNotificationLevel,
} from "@/lib/comms/conversation.service";
import type { NotificationLevel } from "@prisma/client";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const conversation = await getConversationDetail(
    user.organizationId!,
    id,
    user.id
  );
  return NextResponse.json({ conversation });
}, "dash");

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const body = await req.json();

  if (body.action === "archive") {
    await archiveConversation(user.organizationId!, id, user.id);
    return NextResponse.json({ success: true });
  }

  if (body.action === "set_notification_level") {
    await setNotificationLevel(
      user.organizationId!,
      id,
      user.id,
      body.level as NotificationLevel
    );
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}, "dash");
