"use client";

import { AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionCard as ActionCardType } from "@/hooks/use-attention";

const URGENCY_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  critical: { border: "border-l-red-500", bg: "bg-red-500/5", icon: "text-red-400" },
  high: { border: "border-l-orange-500", bg: "bg-orange-500/5", icon: "text-orange-400" },
  medium: { border: "border-l-amber-500", bg: "bg-amber-500/5", icon: "text-amber-400" },
  low: { border: "border-l-blue-500", bg: "bg-blue-500/5", icon: "text-blue-400" },
};

interface ActionCardProps {
  card: ActionCardType;
  onQuickAction?: (actionCode: string) => void;
  compact?: boolean;
}

export default function ActionCard({ card, onQuickAction, compact }: ActionCardProps) {
  const style = URGENCY_STYLES[card.urgency] ?? URGENCY_STYLES.low;

  if (compact) {
    return (
      <div className={cn("border-l-2 pl-3 py-1.5", style.border)}>
        <p className="text-xs text-text-primary font-medium leading-tight">{card.title}</p>
        <p className="text-[10px] text-text-dim mt-0.5">{card.reason.slice(0, 80)}</p>
      </div>
    );
  }

  return (
    <div className={cn("border border-border rounded-xl overflow-hidden", style.bg)}>
      <div className={cn("border-l-3 pl-4 pr-4 py-3", style.border)}>
        <div className="flex items-start gap-2">
          <AlertTriangle className={cn("w-4 h-4 mt-0.5 shrink-0", style.icon)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase",
                card.urgency === "critical" ? "bg-red-500/20 text-red-400" :
                card.urgency === "high" ? "bg-orange-500/20 text-orange-400" :
                card.urgency === "medium" ? "bg-amber-500/20 text-amber-400" :
                "bg-blue-500/20 text-blue-400"
              )}>
                {card.urgency}
              </span>
              <span className="text-[10px] text-text-dim uppercase">{card.module}</span>
            </div>
            <p className="text-sm text-text-primary font-medium">{card.title}</p>
            <p className="text-xs text-text-dim mt-1">{card.reason}</p>

            {card.quickActions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {card.quickActions.map((qa) => (
                  <button
                    key={qa.actionCode}
                    onClick={() => onQuickAction?.(qa.actionCode)}
                    className={cn(
                      "text-[10px] px-2.5 py-1 rounded-lg font-medium transition-colors",
                      qa.variant === "primary"
                        ? "bg-accent/20 text-accent hover:bg-accent/30"
                        : qa.variant === "danger"
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          : "bg-white/5 text-text-muted hover:bg-white/10"
                    )}
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
