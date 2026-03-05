"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Trash2, Square, Brain, Sunrise, Scale, Clock, Mail, Building2, User, Sparkles } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useAiChat } from "@/hooks/use-ai-chat";
import { cn } from "@/lib/utils";

const quickActions = [
  { label: "Morning briefing", icon: Sunrise, prompt: "Give me my morning briefing. What are the top 5 tenants needing immediate attention and why? List stale cases (no notes in 14+ days on 60+ day arrears), any court dates this week, leases expiring in 30 days with no renewal started, and tenants who recently crossed an arrears threshold. For each item, recommend a specific action." },
  { label: "Who needs legal?", icon: Scale, prompt: "Analyze my portfolio and identify tenants who should be sent to an attorney. Consider: balance amount, months owed, payment history pattern, lease status, and collection score. For each recommendation, explain WHY and what type of legal action (nonpayment, holdover, etc.). Rank by urgency." },
  { label: "Stale cases", icon: Clock, prompt: "Find cases that are falling through the cracks: tenants with 60+ day arrears and no notes in the last 14 days, legal cases with no recent activity, tenants with high collection scores but no recent communication. For each, suggest what to do next." },
  { label: "Portfolio insights", icon: Building2, prompt: "Give me a portfolio health analysis: collection trend by building, buildings needing the most attention, estimated revenue at risk, vacancy impact, and specific recommendations to improve collection rate. Be specific with numbers and building names." },
];

export default function AiChatPanel() {
  const { aiPanelOpen, setAiPanelOpen, aiTenantId } = useAppStore();
  const { messages, isStreaming, sendMessage, stopStreaming, clearChat } = useAiChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (aiPanelOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [aiPanelOpen]);

  // Auto-trigger tenant analysis when opened for a specific tenant
  useEffect(() => {
    if (aiPanelOpen && aiTenantId && messages.length === 0) {
      sendMessage(
        "Analyze this tenant in detail. Give me: 1) Risk assessment - likelihood of paying vs needing legal action. 2) Recommended next step based on their history pattern. 3) Key observations from their notes and payment history. 4) Draft talking points for the next call. 5) If appropriate, draft a demand letter or collection email.",
        aiTenantId
      );
    }
  }, [aiPanelOpen, aiTenantId]);

  function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text, aiTenantId);
  }

  function handleQuickAction(prompt: string) {
    if (isStreaming) return;
    sendMessage(prompt, aiTenantId);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Overlay */}
      {aiPanelOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setAiPanelOpen(false)}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-xl bg-card border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out",
          aiPanelOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-text-primary">AtlasPM AI</h2>
            {aiTenantId && (
              <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">Tenant Analysis</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearChat}
              className="p-1.5 rounded-lg text-text-dim hover:text-text-muted hover:bg-card-hover transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setAiPanelOpen(false)}
              className="p-1.5 rounded-lg text-text-dim hover:text-text-muted hover:bg-card-hover transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isStreaming ? (
            <EmptyState onQuickAction={handleQuickAction} tenantMode={!!aiTenantId} />
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} isStreaming={isStreaming && msg === messages[messages.length - 1] && msg.role === "assistant"} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions row when chat has messages */}
        {messages.length > 0 && !aiTenantId && (
          <div className="px-4 py-2 border-t border-border flex gap-2 overflow-x-auto shrink-0">
            {quickActions.slice(0, 3).map((qa) => (
              <button
                key={qa.label}
                onClick={() => handleQuickAction(qa.prompt)}
                disabled={isStreaming}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-text-dim hover:text-accent bg-bg rounded-lg border border-border hover:border-accent/50 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                <qa.icon className="w-3 h-3" />
                {qa.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-border shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={aiTenantId ? "Ask about this tenant..." : "Ask AtlasPM AI anything..."}
              rows={1}
              className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent resize-none max-h-24"
              style={{ minHeight: "38px" }}
            />
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors shrink-0"
                title="Stop"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 rounded-lg bg-accent text-white hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function EmptyState({ onQuickAction, tenantMode }: { onQuickAction: (prompt: string) => void; tenantMode: boolean }) {
  if (tenantMode) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <User className="w-10 h-10 text-accent mb-3" />
        <p className="text-text-muted text-sm">Loading tenant analysis...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <Sparkles className="w-10 h-10 text-accent mb-3" />
      <h3 className="text-text-primary font-medium mb-1">AtlasPM AI Assistant</h3>
      <p className="text-text-dim text-xs mb-6 text-center max-w-sm">
        I have access to your full portfolio data. Ask me anything about your tenants, buildings, collections, or legal cases.
      </p>
      <div className="w-full space-y-2">
        {quickActions.map((qa) => (
          <button
            key={qa.label}
            onClick={() => onQuickAction(qa.prompt)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-muted bg-bg rounded-lg border border-border hover:border-accent/50 hover:text-accent transition-colors text-left"
          >
            <qa.icon className="w-4 h-4 shrink-0" />
            {qa.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message, isStreaming }: { message: { role: string; content: string }; isStreaming: boolean }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[90%] rounded-xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-accent text-white rounded-br-sm"
            : "bg-bg border border-border text-text-primary rounded-bl-sm"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="ai-response">
            {message.content ? (
              <MarkdownContent content={message.content} />
            ) : isStreaming ? (
              <LoadingDots />
            ) : null}
            {isStreaming && message.content && <span className="inline-block w-1.5 h-4 bg-accent animate-pulse ml-0.5 align-text-bottom" />}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-1.5 py-1">
      <div className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: "0ms" }} />
      <div className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: "150ms" }} />
      <div className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown rendering for AI responses
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(<h4 key={i} className="font-semibold text-text-primary mt-3 mb-1 text-sm">{formatInline(line.slice(4))}</h4>);
    } else if (line.startsWith("## ")) {
      elements.push(<h3 key={i} className="font-bold text-text-primary mt-3 mb-1">{formatInline(line.slice(3))}</h3>);
    } else if (line.startsWith("# ")) {
      elements.push(<h2 key={i} className="font-bold text-accent mt-3 mb-2 text-base">{formatInline(line.slice(2))}</h2>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2 ml-2 my-0.5">
          <span className="text-accent mt-0.5 shrink-0">&#x2022;</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 ml-2 my-0.5">
          <span className="text-accent font-medium shrink-0">{num}.</span>
          <span>{formatInline(line.replace(/^\d+\.\s/, ""))}</span>
        </div>
      );
    } else if (line.startsWith("---") || line.startsWith("***")) {
      elements.push(<hr key={i} className="border-border my-2" />);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="my-0.5">{formatInline(line)}</p>);
    }
  }

  return <>{elements}</>;
}

function formatInline(text: string): React.ReactNode {
  // Handle **bold** and *italic*
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
      }
      parts.push(<strong key={key++} className="text-text-primary font-semibold">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
