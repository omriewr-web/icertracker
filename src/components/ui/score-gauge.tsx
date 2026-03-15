"use client";

import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export default function ScoreGauge({ score, size = 80, strokeWidth = 6, label, className }: ScoreGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const center = size / 2;

  const color =
    score >= 80 ? "var(--atlas-green)" :
    score >= 50 ? "var(--atlas-amber)" :
    "var(--atlas-red)";

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--atlas-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute font-data text-sm font-bold" style={{ color }}>
        {score}
      </span>
      {label && <span className="text-[10px] text-text-dim uppercase tracking-wider">{label}</span>}
    </div>
  );
}
