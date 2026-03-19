"use client";

import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 ring-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 ring-orange-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  LOW: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  OK: "bg-green-500/15 text-green-400 ring-green-500/30",
};

interface AttentionBadgeProps {
  score: number;
  label: string;
  showScore?: boolean;
  size?: "sm" | "md";
}

export default function AttentionBadge({
  score,
  label,
  showScore = true,
  size = "sm",
}: AttentionBadgeProps) {
  const color = COLORS[label] ?? COLORS.OK;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full ring-1 font-bold font-mono tabular-nums",
        color,
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      )}
    >
      {showScore && <span>{score}</span>}
      {!showScore && <span>{label}</span>}
    </span>
  );
}
