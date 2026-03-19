import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const memberships = await prisma.conversationMember.findMany({
    where: {
      userId: user.id,
      leftAt: null,
      notificationLevel: { not: "muted" },
      conversation: { orgId: user.organizationId!, isArchived: false },
    },
    select: {
      lastReadAt: true,
      conversation: {
        select: { id: true, lastMessageAt: true },
      },
    },
  });

  const unreadCount = memberships.filter(
    (m) =>
      m.conversation.lastMessageAt &&
      (!m.lastReadAt || m.conversation.lastMessageAt > m.lastReadAt)
  ).length;

  return NextResponse.json({ unreadCount });
}, "dash");
