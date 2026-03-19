"use client";

import { useRef, useEffect } from "react";
import { useState } from "react";
import { ArrowLeft, Users, Hash, Wrench, Building2, User, Pin, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import { useMessages, useConversationDetail, useMarkRead } from "@/hooks/use-comms";
import { useSummarizeThread } from "@/hooks/use-attention";
import MessageBubble from "./MessageBubble";
import MessageComposer from "./MessageComposer";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, typeof Hash> = {
  direct: User,
  group: Users,
  work_order: Wrench,
  building: Building2,
  unit: Hash,
  tenant: User,
};

interface ConversationViewProps {
  conversationId: string;
  onBack?: () => void;
}

export default function ConversationView({
  conversationId,
  onBack,
}: ConversationViewProps) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const { data: detail } = useConversationDetail(conversationId);
  const { data: messages, isLoading } = useMessages(conversationId);
  const markRead = useMarkRead();
  const summarize = useSummarizeThread();
  const [summary, setSummary] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  // Mark read when last message changes
  useEffect(() => {
    if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      markRead.mutate({ conversationId, lastMessageId: lastMsg.id });
    }
  }, [messages?.length, conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const convo = detail;
  const Icon = TYPE_ICONS[convo?.type ?? "group"] ?? Hash;
  const memberCount = convo?.members?.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-atlas-navy-3 shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 text-text-dim hover:text-text-primary transition-colors md:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <Icon className="w-4 h-4 text-text-dim shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-text-primary truncate">
            {convo?.title ?? "Conversation"}
          </h2>
          <p className="text-[10px] text-text-dim">
            {memberCount} member{memberCount !== 1 ? "s" : ""}
            {convo?.relatedEntityType && (
              <span className="ml-2 text-accent">
                {convo.relatedEntityType.replace(/_/g, " ")}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => {
            summarize.mutate(conversationId, {
              onSuccess: (text) => setSummary(text),
            });
          }}
          disabled={summarize.isPending}
          className="p-1.5 rounded-lg text-text-dim hover:text-accent hover:bg-accent/10 transition-colors shrink-0"
          title="Summarize thread"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </div>

      {/* Pinned messages */}
      {convo?.pinnedMessages?.length > 0 && (
        <div className="px-4 py-2 bg-accent/5 border-b border-accent/20 flex items-center gap-2">
          <Pin className="w-3 h-3 text-accent shrink-0" />
          <span className="text-xs text-text-muted truncate">
            {convo.pinnedMessages[0].message.body}
          </span>
        </div>
      )}

      {/* AI Summary */}
      {(summary || summarize.isPending) && (
        <div className="px-4 py-2.5 bg-accent/5 border-b border-accent/20">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3 h-3 text-accent" />
            <span className="text-[10px] text-accent font-medium uppercase tracking-wider">AI Summary</span>
            <button
              onClick={() => setSummary(null)}
              className="ml-auto text-[10px] text-text-dim hover:text-text-muted"
            >
              Dismiss
            </button>
          </div>
          {summarize.isPending ? (
            <div className="h-3 bg-white/5 rounded animate-pulse w-3/4" />
          ) : (
            <p className="text-xs text-text-muted">{summary}</p>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-text-dim">Loading messages...</div>
          </div>
        ) : messages && messages.length > 0 ? (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isCurrentUser={msg.senderUserId === currentUserId}
                currentUserId={currentUserId}
              />
            ))}
            <div ref={bottomRef} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-text-dim">
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Start the conversation below</p>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <MessageComposer conversationId={conversationId} />
    </div>
  );
}
