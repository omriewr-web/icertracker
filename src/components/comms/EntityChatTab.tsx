"use client";

import { Wrench, Building2, Hash, User } from "lucide-react";
import { useEntityThread } from "@/hooks/use-comms";
import ConversationView from "./ConversationView";

const ENTITY_META: Record<
  string,
  { icon: typeof Wrench; emoji: string; label: string }
> = {
  work_order: { icon: Wrench, emoji: "🔧", label: "Work Order" },
  building: { icon: Building2, emoji: "🏢", label: "Building" },
  unit: { icon: Hash, emoji: "🚪", label: "Unit" },
  tenant: { icon: User, emoji: "👤", label: "Tenant" },
};

interface EntityChatTabProps {
  entityType: "work_order" | "building" | "unit" | "tenant";
  entityId: string;
  label?: string;
  buildingAddress?: string;
}

export default function EntityChatTab({
  entityType,
  entityId,
  label,
  buildingAddress,
}: EntityChatTabProps) {
  const { data: conversation, isLoading, error } = useEntityThread(
    entityType,
    entityId
  );

  const meta = ENTITY_META[entityType] ?? ENTITY_META.work_order;
  const Icon = meta.icon;

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-sm text-text-dim">Loading discussion...</div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-sm text-text-dim">
          Unable to load discussion thread.
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden" style={{ height: 500 }}>
      {/* Entity context chip */}
      <div className="px-4 py-2 bg-accent/5 border-b border-accent/20 flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-accent" />
        <span className="text-xs text-accent font-medium">
          {meta.label}
          {label && <span className="text-text-muted ml-1">· {label}</span>}
        </span>
        {buildingAddress && (
          <span className="text-[10px] text-text-dim ml-auto">
            {buildingAddress}
          </span>
        )}
      </div>

      {/* Conversation view */}
      <div style={{ height: "calc(100% - 36px)" }}>
        <ConversationView conversationId={conversation.id} />
      </div>
    </div>
  );
}
