"use client";

import { useState, useMemo } from "react";
import {
  Search,
  User,
  Users,
  Wrench,
  Building2,
  Hash,
  Plus,
  MessageSquare,
} from "lucide-react";
import { useConversations, type ConversationListItem } from "@/hooks/use-comms";
import { cn } from "@/lib/utils";
import NewConversationModal from "./NewConversationModal";

const TABS = [
  { key: "all", label: "All" },
  { key: "direct", label: "DMs" },
  { key: "group", label: "Groups" },
  { key: "work_order", label: "Work Orders" },
  { key: "unread", label: "Unread" },
] as const;

const ENTITY_ICONS: Record<string, string> = {
  work_order: "🔧",
  building: "🏢",
  unit: "🚪",
  tenant: "👤",
  violation: "⚠️",
  legal_case: "⚖️",
};

const TYPE_ICONS: Record<string, typeof Hash> = {
  direct: User,
  group: Users,
  work_order: Wrench,
  building: Building2,
  unit: Hash,
  tenant: User,
};

function timeLabel(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface ConversationSidebarProps {
  onSelectConversation: (id: string) => void;
  activeConversationId: string | null;
  initialFilter?: string;
}

export default function ConversationSidebar({
  onSelectConversation,
  activeConversationId,
  initialFilter,
}: ConversationSidebarProps) {
  const [tab, setTab] = useState(initialFilter ?? "all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const typeFilter =
    tab === "all" || tab === "unread" ? undefined : tab;
  const { data: conversations, isLoading } = useConversations({
    type: typeFilter,
  });

  const filtered = useMemo(() => {
    let list = conversations ?? [];
    if (tab === "unread") list = list.filter((c) => c.hasUnread);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.lastMessage?.body.toLowerCase().includes(q) ||
          c.relatedEntityLabel?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [conversations, tab, search]);

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-3 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-text-primary">Messages</span>
          </div>
          <button
            onClick={() => setNewOpen(true)}
            className="p-1.5 rounded-lg text-text-dim hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-3 pb-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap transition-colors",
                tab === t.key
                  ? "bg-accent/20 text-accent"
                  : "text-text-dim hover:text-text-muted"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 px-3 pt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-text-dim">
              <MessageSquare className="w-6 h-6 mb-2 opacity-30" />
              <p className="text-xs">No conversations</p>
            </div>
          ) : (
            filtered.map((c) => {
              const Icon = TYPE_ICONS[c.type] ?? Hash;
              const isActive = c.id === activeConversationId;

              return (
                <button
                  key={c.id}
                  onClick={() => onSelectConversation(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 flex gap-2.5 transition-colors border-l-2",
                    isActive
                      ? "bg-accent/10 border-l-accent"
                      : "border-l-transparent hover:bg-white/[0.03]",
                    c.hasUnread && !isActive && "bg-white/[0.02]"
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-xs font-medium truncate",
                          c.hasUnread
                            ? "text-text-primary"
                            : "text-text-muted"
                        )}
                      >
                        {c.title ?? "Conversation"}
                      </span>
                      <span className="text-[10px] text-text-dim shrink-0">
                        {timeLabel(c.lastMessageAt ?? c.lastMessage?.createdAt ?? null)}
                      </span>
                    </div>

                    {/* Entity label subtitle */}
                    {c.relatedEntityType && c.relatedEntityLabel && (
                      <p className="text-[10px] text-accent truncate">
                        {ENTITY_ICONS[c.relatedEntityType] ?? ""}{" "}
                        {c.relatedEntityLabel}
                      </p>
                    )}

                    {/* Last message */}
                    {c.lastMessage && (
                      <p className="text-[10px] text-text-dim truncate mt-0.5">
                        {c.lastMessage.isSystemGenerated
                          ? c.lastMessage.body
                          : `${c.lastMessage.senderName}: ${c.lastMessage.body}`}
                      </p>
                    )}
                  </div>

                  {/* Unread dot */}
                  {c.hasUnread && (
                    <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-2" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      <NewConversationModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          setNewOpen(false);
          onSelectConversation(id);
        }}
      />
    </>
  );
}
