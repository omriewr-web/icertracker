import { prisma } from "@/lib/prisma";
import type { MessageType, Prisma } from "@prisma/client";

// ─── Send message ──────────────────────────────────────────────

export async function sendMessage(params: {
  conversationId: string;
  senderUserId: string;
  orgId: string;
  body: string;
  messageType?: MessageType;
  replyToMessageId?: string;
  mentionedUserIds?: string[];
  metadata?: Record<string, unknown>;
}) {
  const {
    conversationId,
    senderUserId,
    orgId,
    body,
    messageType = "standard",
    replyToMessageId,
    mentionedUserIds = [],
    metadata,
  } = params;

  const membership = await prisma.conversationMember.findFirst({
    where: {
      conversationId,
      userId: senderUserId,
      leftAt: null,
      conversation: { orgId },
    },
  });
  if (!membership) throw new Error("Not a member of this conversation");

  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        conversationId,
        senderUserId,
        body,
        messageType,
        replyToMessageId: replyToMessageId ?? null,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        isSystemGenerated: false,
      },
    });

    if (mentionedUserIds.length > 0) {
      await tx.messageMention.createMany({
        data: mentionedUserIds.map((mentionedUserId) => ({
          messageId: message.id,
          mentionedUserId,
        })),
        skipDuplicates: true,
      });
    }

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  });
}

// ─── Post system event ─────────────────────────────────────────

export async function postSystemEvent(params: {
  conversationId: string;
  body: string;
  metadata?: Record<string, unknown>;
}) {
  const { conversationId, body, metadata } = params;

  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        conversationId,
        senderUserId: null,
        body,
        messageType: "system_event",
        isSystemGenerated: true,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  });
}

// ─── List messages ─────────────────────────────────────────────

export async function listMessages(params: {
  conversationId: string;
  userId: string;
  orgId: string;
  cursor?: string;
  limit?: number;
}) {
  const { conversationId, userId, orgId, cursor, limit = 50 } = params;

  const membership = await prisma.conversationMember.findFirst({
    where: {
      conversationId,
      userId,
      leftAt: null,
      conversation: { orgId },
    },
  });
  if (!membership) throw new Error("Access denied");

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      attachments: true,
      reactions: true,
      mentions: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Resolve sender names
  const senderIds = new Set(
    messages.filter((m) => m.senderUserId).map((m) => m.senderUserId!)
  );
  const senderMap = new Map<string, string>();
  if (senderIds.size > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(senderIds) } },
      select: { id: true, name: true },
    });
    for (const u of users) senderMap.set(u.id, u.name);
  }

  return messages.reverse().map((m) => ({
    ...m,
    senderName: m.senderUserId
      ? senderMap.get(m.senderUserId) ?? "Unknown"
      : null,
  }));
}

// ─── Add attachment ────────────────────────────────────────────

export async function addAttachment(params: {
  messageId: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  imageWidth?: number;
  imageHeight?: number;
}) {
  return prisma.messageAttachment.create({ data: params });
}

// ─── Toggle reaction ───────────────────────────────────────────

export async function toggleReaction(
  messageId: string,
  userId: string,
  reaction: string
) {
  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_reaction: { messageId, userId, reaction } },
  });

  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
    return { action: "removed" as const };
  }

  await prisma.messageReaction.create({
    data: { messageId, userId, reaction },
  });
  return { action: "added" as const };
}

// ─── Soft delete message ───────────────────────────────────────

export async function deleteMessage(
  messageId: string,
  userId: string,
  orgId: string
) {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      senderUserId: userId,
      isSystemGenerated: false,
      conversation: { orgId },
    },
  });

  if (!message) throw new Error("Message not found or cannot be deleted");

  return prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), body: "[Message deleted]" },
  });
}

// ─── Pin / unpin ───────────────────────────────────────────────

export async function pinMessage(
  conversationId: string,
  messageId: string,
  pinnedByUserId: string
) {
  return prisma.pinnedMessage.upsert({
    where: { conversationId_messageId: { conversationId, messageId } },
    update: { pinnedByUserId, pinnedAt: new Date() },
    create: { conversationId, messageId, pinnedByUserId },
  });
}

export async function unpinMessage(
  conversationId: string,
  messageId: string
) {
  return prisma.pinnedMessage.deleteMany({
    where: { conversationId, messageId },
  });
}
