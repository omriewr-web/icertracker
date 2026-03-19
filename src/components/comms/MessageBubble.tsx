"use client";

import { cn } from "@/lib/utils";
import type { MessageItem } from "@/hooks/use-comms";

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface MessageBubbleProps {
  message: MessageItem;
  isCurrentUser: boolean;
  currentUserId: string;
}

export default function MessageBubble({
  message,
  isCurrentUser,
  currentUserId,
}: MessageBubbleProps) {
  // System events
  if (message.isSystemGenerated) {
    return (
      <div className="flex justify-center py-1.5">
        <span className="text-[11px] text-text-dim italic px-3">
          {message.body}
        </span>
      </div>
    );
  }

  const initial = message.senderName?.[0]?.toUpperCase() ?? "?";
  const isBlocker = message.messageType === "blocker";
  const isApproval = message.messageType === "approval_request";

  return (
    <div
      className={cn(
        "flex gap-2.5 px-4 py-1.5 hover:bg-white/[0.02] transition-colors",
        isBlocker && "border-l-2 border-l-red-500",
        isApproval && "border-l-2 border-l-amber-500"
      )}
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
        {initial}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              isCurrentUser ? "text-accent" : "text-text-primary"
            )}
          >
            {message.senderName ?? "Unknown"}
          </span>
          <span className="text-[10px] text-text-dim">
            {timeAgo(message.createdAt)}
          </span>
          {isBlocker && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold uppercase">
              Blocker
            </span>
          )}
          {isApproval && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold uppercase">
              Approval
            </span>
          )}
        </div>
        <p className="text-sm text-text-muted whitespace-pre-wrap break-words mt-0.5">
          {message.body}
        </p>

        {/* Attachments */}
        {message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.attachments.map((att) => (
              <a
                key={att.id}
                href={att.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-border text-xs text-text-muted hover:bg-white/10 transition-colors"
              >
                {att.mimeType.startsWith("image/") ? "🖼" : "📎"}{" "}
                {att.fileName}
              </a>
            ))}
          </div>
        )}

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {Object.entries(
              message.reactions.reduce(
                (acc, r) => {
                  acc[r.reaction] = (acc[r.reaction] ?? 0) + 1;
                  return acc;
                },
                {} as Record<string, number>
              )
            ).map(([reaction, count]) => (
              <span
                key={reaction}
                className="text-xs px-1.5 py-0.5 rounded bg-white/5 border border-border"
              >
                {reaction} {count > 1 ? count : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
