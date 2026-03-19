"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Paperclip } from "lucide-react";
import { useSendMessage } from "@/hooks/use-comms";
import AIEnhanceButton from "@/components/ui/ai-enhance-button";
import { cn } from "@/lib/utils";

interface MessageComposerProps {
  conversationId: string;
  onMessageSent?: () => void;
  placeholder?: string;
}

export default function MessageComposer({
  conversationId,
  onMessageSent,
  placeholder = "Type a message...",
}: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [messageType, setMessageType] = useState<string>("standard");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useSendMessage();

  const handleSend = useCallback(() => {
    const trimmed = body.trim();
    if (!trimmed || sendMessage.isPending) return;

    sendMessage.mutate(
      { conversationId, body: trimmed, messageType },
      {
        onSuccess: () => {
          setBody("");
          setMessageType("standard");
          if (textareaRef.current) textareaRef.current.style.height = "auto";
          onMessageSent?.();
        },
      }
    );
  }, [body, conversationId, messageType, sendMessage, onMessageSent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  };

  const typeColor =
    messageType === "blocker"
      ? "border-l-red-500"
      : messageType === "approval_request"
        ? "border-l-amber-500"
        : "border-l-transparent";

  return (
    <div className="border-t border-border bg-atlas-navy-3 px-4 py-3">
      {/* Message type selector */}
      <div className="flex items-center gap-1.5 mb-2">
        {[
          { value: "standard", label: "Message" },
          { value: "blocker", label: "Blocker" },
          { value: "approval_request", label: "Approval" },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => setMessageType(t.value)}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors",
              messageType === t.value
                ? t.value === "blocker"
                  ? "bg-red-500/20 text-red-400"
                  : t.value === "approval_request"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-accent/20 text-accent"
                : "text-text-dim hover:text-text-muted"
            )}
          >
            {t.label}
          </button>
        ))}
        {body.trim().length > 10 && (
          <AIEnhanceButton
            value={body}
            context="collection_note"
            onEnhanced={(v) => setBody(v)}
          />
        )}
      </div>

      <div className={cn("flex items-end gap-2 border-l-2", typeColor)}>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent resize-none ml-2"
          style={{ maxHeight: 120 }}
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || sendMessage.isPending}
          className="p-2 rounded-lg bg-accent text-white hover:bg-accent/80 disabled:opacity-40 transition-colors shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      {body.length > 1800 && (
        <p
          className={cn(
            "text-[10px] mt-1 text-right",
            body.length > 4500 ? "text-red-400" : "text-text-dim"
          )}
        >
          {body.length}/5000
        </p>
      )}
    </div>
  );
}
