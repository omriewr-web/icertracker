"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────

export interface ConversationListItem {
  id: string;
  type: string;
  title: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  relatedEntityLabel: string | null;
  buildingId: string | null;
  isArchived: boolean;
  lastMessageAt: string | null;
  memberCount: number;
  hasUnread: boolean;
  lastMessage: {
    id: string;
    body: string;
    senderName: string;
    createdAt: string;
    isSystemGenerated: boolean;
  } | null;
  myNotificationLevel: string;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderUserId: string | null;
  senderName: string | null;
  body: string;
  messageType: string;
  replyToMessageId: string | null;
  metadata: Record<string, unknown> | null;
  isSystemGenerated: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  attachments: Array<{
    id: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }>;
  reactions: Array<{
    id: string;
    userId: string;
    reaction: string;
  }>;
  mentions: Array<{
    id: string;
    mentionedUserId: string;
  }>;
}

// ── Conversations ─────────────────────────────────────────────

export function useConversations(filter?: { type?: string; archived?: boolean }) {
  const params = new URLSearchParams();
  if (filter?.type) params.set("type", filter.type);
  if (filter?.archived) params.set("archived", "true");

  return useQuery<ConversationListItem[]>({
    queryKey: ["comms", "conversations", filter?.type, filter?.archived],
    queryFn: async () => {
      const res = await fetch(`/api/comms/conversations?${params}`);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const data = await res.json();
      return data.conversations;
    },
    refetchInterval: 15000,
  });
}

// ── Conversation Detail ───────────────────────────────────────

export function useConversationDetail(conversationId: string | null) {
  return useQuery({
    queryKey: ["comms", "conversation", conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/comms/conversations/${conversationId}`);
      if (!res.ok) throw new Error("Failed to fetch conversation");
      const data = await res.json();
      return data.conversation;
    },
    enabled: !!conversationId,
  });
}

// ── Messages ──────────────────────────────────────────────────

export function useMessages(conversationId: string | null) {
  return useQuery<MessageItem[]>({
    queryKey: ["comms", "messages", conversationId],
    queryFn: async () => {
      const res = await fetch(
        `/api/comms/conversations/${conversationId}/messages`
      );
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      return data.messages;
    },
    enabled: !!conversationId,
    refetchInterval: 5000,
  });
}

// ── Send Message ──────────────────────────────────────────────

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      body,
      messageType,
      replyToMessageId,
      mentionedUserIds,
    }: {
      conversationId: string;
      body: string;
      messageType?: string;
      replyToMessageId?: string;
      mentionedUserIds?: string[];
    }) => {
      const res = await fetch(
        `/api/comms/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body,
            messageType,
            replyToMessageId,
            mentionedUserIds,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["comms", "messages", vars.conversationId],
      });
      qc.invalidateQueries({ queryKey: ["comms", "conversations"] });
    },
    onError: () => toast.error("Failed to send message"),
  });
}

// ── Create Conversation ───────────────────────────────────────

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      type: "direct" | "group";
      targetUserId?: string;
      title?: string;
      memberIds?: string[];
      relatedEntityType?: string;
      relatedEntityId?: string;
      buildingId?: string;
    }) => {
      const res = await fetch("/api/comms/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comms", "conversations"] });
      toast.success("Conversation created");
    },
    onError: () => toast.error("Failed to create conversation"),
  });
}

// ── Entity Thread ─────────────────────────────────────────────

export function useEntityThread(
  entityType: string | null,
  entityId: string | null
) {
  return useQuery({
    queryKey: ["comms", "entity-thread", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(
        `/api/comms/entity-thread?entityType=${entityType}&entityId=${entityId}`
      );
      if (!res.ok) throw new Error("Failed to get entity thread");
      const data = await res.json();
      return data.conversation;
    },
    enabled: !!entityType && !!entityId,
  });
}

// ── Mark Read ─────────────────────────────────────────────────

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      lastMessageId,
    }: {
      conversationId: string;
      lastMessageId: string;
    }) => {
      await fetch(`/api/comms/conversations/${conversationId}/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastMessageId }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comms", "conversations"] });
      qc.invalidateQueries({ queryKey: ["comms", "unread-count"] });
    },
  });
}

// ── Unread Count ──────────────────────────────────────────────

export function useUnreadCount() {
  return useQuery<number>({
    queryKey: ["comms", "unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/comms/unread-count");
      if (!res.ok) return 0;
      const data = await res.json();
      return data.unreadCount;
    },
    refetchInterval: 30000,
  });
}

// ── Archive / Mute ────────────────────────────────────────────

export function useConversationActions() {
  const qc = useQueryClient();

  const archive = useMutation({
    mutationFn: async (conversationId: string) => {
      await fetch(`/api/comms/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comms", "conversations"] });
      toast.success("Conversation archived");
    },
  });

  const setNotificationLevel = useMutation({
    mutationFn: async ({
      conversationId,
      level,
    }: {
      conversationId: string;
      level: string;
    }) => {
      await fetch(`/api/comms/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_notification_level", level }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comms", "conversations"] });
      toast.success("Notification level updated");
    },
  });

  return { archive, setNotificationLevel };
}
