import { prisma } from "@/lib/prisma";
import type {
  ConversationType,
  ConversationMemberRole,
  NotificationLevel,
} from "@prisma/client";

// ─── Get or create direct conversation ─────────────────────────

export async function getOrCreateDirectConversation(
  orgId: string,
  userId: string,
  targetUserId: string
) {
  // Find existing direct conversation between these two users
  const existing = await prisma.conversation.findFirst({
    where: {
      orgId,
      type: "direct",
      AND: [
        { members: { some: { userId, leftAt: null } } },
        { members: { some: { userId: targetUserId, leftAt: null } } },
      ],
    },
    include: {
      members: { where: { leftAt: null }, select: { userId: true, role: true } },
    },
  });

  if (existing && existing.members.length === 2) return existing;

  return prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        orgId,
        type: "direct",
        visibility: "internal",
        createdByUserId: userId,
      },
    });

    await tx.conversationMember.createMany({
      data: [
        { conversationId: conversation.id, userId, role: "member" },
        { conversationId: conversation.id, userId: targetUserId, role: "member" },
      ],
    });

    return tx.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
      include: {
        members: { where: { leftAt: null }, select: { userId: true, role: true } },
      },
    });
  });
}

// ─── Create group conversation ─────────────────────────────────

export async function createGroupConversation(
  orgId: string,
  userId: string,
  title: string,
  memberIds: string[],
  relatedEntityType?: string,
  relatedEntityId?: string,
  buildingId?: string
) {
  const allMemberIds = Array.from(new Set([userId, ...memberIds]));

  return prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        orgId,
        type: "group",
        title,
        visibility: "internal",
        createdByUserId: userId,
        relatedEntityType: relatedEntityType ?? null,
        relatedEntityId: relatedEntityId ?? null,
        buildingId: buildingId ?? null,
      },
    });

    await tx.conversationMember.createMany({
      data: allMemberIds.map((uid) => ({
        conversationId: conversation.id,
        userId: uid,
        role: (uid === userId ? "admin" : "member") as ConversationMemberRole,
      })),
    });

    return conversation;
  });
}

// ─── Get or create entity thread ───────────────────────────────

export async function getOrCreateEntityThread(
  orgId: string,
  userId: string,
  entityType: string,
  entityId: string,
  title: string,
  buildingId?: string | null
) {
  const existing = await prisma.conversation.findFirst({
    where: {
      orgId,
      relatedEntityType: entityType,
      relatedEntityId: entityId,
    },
  });

  const conversation =
    existing ??
    (await prisma.conversation.create({
      data: {
        orgId,
        type: entityType as ConversationType,
        relatedEntityType: entityType,
        relatedEntityId: entityId,
        buildingId: buildingId ?? null,
        visibility: "internal",
        createdByUserId: userId,
        title,
      },
    }));

  // Upsert membership
  await prisma.conversationMember.upsert({
    where: {
      conversationId_userId: { conversationId: conversation.id, userId },
    },
    update: { leftAt: null },
    create: { conversationId: conversation.id, userId, role: "member" },
  });

  return conversation;
}

// ─── List conversations for user ───────────────────────────────

export async function listUserConversations(
  orgId: string,
  userId: string,
  filter?: {
    type?: ConversationType;
    isArchived?: boolean;
  }
) {
  const conversations = await prisma.conversation.findMany({
    where: {
      orgId,
      isArchived: filter?.isArchived ?? false,
      members: { some: { userId, leftAt: null } },
      ...(filter?.type ? { type: filter.type } : {}),
    },
    include: {
      members: {
        where: { leftAt: null },
        select: {
          userId: true,
          lastReadMessageId: true,
          lastReadAt: true,
          notificationLevel: true,
          role: true,
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          body: true,
          senderUserId: true,
          createdAt: true,
          messageType: true,
          isSystemGenerated: true,
        },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  // Batch-resolve related entity labels
  const entityConvos = conversations.filter(
    (c) => c.relatedEntityType && c.relatedEntityId
  );
  const labelMap = new Map<string, string>();

  if (entityConvos.length > 0) {
    const byType = new Map<string, string[]>();
    for (const c of entityConvos) {
      const list = byType.get(c.relatedEntityType!) ?? [];
      list.push(c.relatedEntityId!);
      byType.set(c.relatedEntityType!, list);
    }

    for (const [type, ids] of byType) {
      if (type === "work_order") {
        const wos = await prisma.workOrder.findMany({
          where: { id: { in: ids } },
          select: { id: true, title: true },
        });
        for (const wo of wos) labelMap.set(`work_order:${wo.id}`, wo.title);
      } else if (type === "building") {
        const buildings = await prisma.building.findMany({
          where: { id: { in: ids } },
          select: { id: true, address: true },
        });
        for (const b of buildings) labelMap.set(`building:${b.id}`, b.address);
      } else if (type === "unit") {
        const units = await prisma.unit.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            unitNumber: true,
            building: { select: { address: true } },
          },
        });
        for (const u of units)
          labelMap.set(
            `unit:${u.id}`,
            `Unit ${u.unitNumber} · ${u.building.address}`
          );
      } else if (type === "tenant") {
        const tenants = await prisma.tenant.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        });
        for (const t of tenants) labelMap.set(`tenant:${t.id}`, t.name);
      }
    }
  }

  // Resolve sender names for last messages
  const senderIds = new Set<string>();
  for (const c of conversations) {
    const last = c.messages[0];
    if (last?.senderUserId) senderIds.add(last.senderUserId);
  }
  const senderMap = new Map<string, string>();
  if (senderIds.size > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(senderIds) } },
      select: { id: true, name: true },
    });
    for (const u of users) senderMap.set(u.id, u.name);
  }

  // Resolve member names for direct conversations
  const directConvos = conversations.filter((c) => c.type === "direct");
  const allDirectMemberIds = new Set<string>();
  for (const c of directConvos) {
    for (const m of c.members) allDirectMemberIds.add(m.userId);
  }
  const memberNameMap = new Map<string, string>();
  if (allDirectMemberIds.size > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(allDirectMemberIds) } },
      select: { id: true, name: true },
    });
    for (const u of users) memberNameMap.set(u.id, u.name);
  }

  return conversations.map((c) => {
    const myMembership = c.members.find((m) => m.userId === userId);
    const lastMsg = c.messages[0] ?? null;
    const hasUnread =
      lastMsg &&
      (!myMembership?.lastReadAt ||
        new Date(lastMsg.createdAt) > new Date(myMembership.lastReadAt));

    // For direct convos, resolve the other user's name as title
    let resolvedTitle = c.title;
    if (c.type === "direct" && !c.title) {
      const other = c.members.find((m) => m.userId !== userId);
      resolvedTitle = other ? memberNameMap.get(other.userId) ?? "Direct Message" : "Direct Message";
    }

    return {
      id: c.id,
      type: c.type,
      title: resolvedTitle,
      relatedEntityType: c.relatedEntityType,
      relatedEntityId: c.relatedEntityId,
      relatedEntityLabel:
        c.relatedEntityType && c.relatedEntityId
          ? labelMap.get(`${c.relatedEntityType}:${c.relatedEntityId}`) ?? null
          : null,
      buildingId: c.buildingId,
      isArchived: c.isArchived,
      lastMessageAt: c.lastMessageAt,
      memberCount: c.members.length,
      hasUnread,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            body:
              lastMsg.body.length > 100
                ? lastMsg.body.slice(0, 100) + "…"
                : lastMsg.body,
            senderName: lastMsg.senderUserId
              ? senderMap.get(lastMsg.senderUserId) ?? "Unknown"
              : "System",
            createdAt: lastMsg.createdAt,
            isSystemGenerated: lastMsg.isSystemGenerated,
          }
        : null,
      myNotificationLevel: myMembership?.notificationLevel ?? "all",
    };
  });
}

// ─── Get conversation detail ───────────────────────────────────

export async function getConversationDetail(
  orgId: string,
  conversationId: string,
  userId: string
) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      orgId,
      members: { some: { userId, leftAt: null } },
    },
    include: {
      members: {
        where: { leftAt: null },
        select: {
          userId: true,
          role: true,
          notificationLevel: true,
          lastReadMessageId: true,
          lastReadAt: true,
        },
      },
      pinnedMessages: {
        include: { message: { select: { id: true, body: true, createdAt: true } } },
        orderBy: { pinnedAt: "desc" },
      },
    },
  });

  if (!conversation) throw new Error("Conversation not found or access denied");

  // Resolve member names
  const memberIds = conversation.members.map((m) => m.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return {
    ...conversation,
    members: conversation.members.map((m) => ({
      ...m,
      name: userMap.get(m.userId)?.name ?? "Unknown",
      email: userMap.get(m.userId)?.email ?? null,
    })),
  };
}

// ─── Archive conversation ──────────────────────────────────────

export async function archiveConversation(
  orgId: string,
  conversationId: string,
  userId: string
) {
  await assertConversationAccess(orgId, conversationId, userId);
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { isArchived: true, archivedAt: new Date() },
  });
}

// ─── Set notification level ────────────────────────────────────

export async function setNotificationLevel(
  orgId: string,
  conversationId: string,
  userId: string,
  level: NotificationLevel
) {
  await assertConversationAccess(orgId, conversationId, userId);
  return prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { notificationLevel: level },
  });
}

// ─── Add members to group ──────────────────────────────────────

export async function addGroupMembers(
  orgId: string,
  conversationId: string,
  adminUserId: string,
  newMemberIds: string[]
) {
  await assertAdminAccess(orgId, conversationId, adminUserId);
  await prisma.conversationMember.createMany({
    data: newMemberIds.map((userId) => ({
      conversationId,
      userId,
      role: "member" as ConversationMemberRole,
    })),
    skipDuplicates: true,
  });
}

// ─── Remove member from group ──────────────────────────────────

export async function removeGroupMember(
  orgId: string,
  conversationId: string,
  adminUserId: string,
  targetUserId: string
) {
  await assertAdminAccess(orgId, conversationId, adminUserId);
  return prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
    data: { leftAt: new Date() },
  });
}

// ─── Mark read ─────────────────────────────────────────────────

export async function markConversationRead(
  conversationId: string,
  userId: string,
  lastMessageId: string
) {
  return prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadMessageId: lastMessageId, lastReadAt: new Date() },
  });
}

// ─── Helpers ───────────────────────────────────────────────────

async function assertConversationAccess(
  orgId: string,
  conversationId: string,
  userId: string
) {
  const member = await prisma.conversationMember.findFirst({
    where: {
      conversationId,
      userId,
      leftAt: null,
      conversation: { orgId },
    },
  });
  if (!member) throw new Error("Access denied");
  return member;
}

async function assertAdminAccess(
  orgId: string,
  conversationId: string,
  userId: string
) {
  const member = await assertConversationAccess(orgId, conversationId, userId);
  if (member.role !== "admin" && member.role !== "moderator") {
    throw new Error("Admin access required");
  }
  return member;
}
