"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface AtlasEmptyProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export default function AtlasEmpty({
  icon: Icon = Inbox,
  title = "No data",
  description = "There's nothing to display yet.",
  action,
  className,
}: AtlasEmptyProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      <div className="w-12 h-12 rounded-full bg-atlas-navy-4 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-text-dim" />
      </div>
      <h3 className="text-sm font-semibold text-text-primary tracking-wide mb-1">{title}</h3>
      <p className="text-xs text-text-dim max-w-xs">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-1.5 text-xs font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/10 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
