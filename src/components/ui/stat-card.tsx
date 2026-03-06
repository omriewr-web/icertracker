"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const ref = useRef(target);
  ref.current = target;

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(Math.round(ease * ref.current));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  color?: string;
  className?: string;
  href?: string;
  onClick?: () => void;
  trend?: { value: number; label?: string };
}

export default function StatCard({
  label, value, subtext, icon: Icon, color, className, href, onClick, trend,
}: StatCardProps) {
  const isNumeric = typeof value === "number";
  const countUpValue = useCountUp(isNumeric ? value : 0);
  const clickable = !!(href || onClick);

  const content = (
    <div
      className={cn(
        "bg-card-gradient border border-border rounded-xl p-4 group",
        clickable && "card-hover-lift cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-text-dim uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold font-mono mt-1 tabular-nums" style={color ? { color } : undefined}>
            {isNumeric ? countUpValue : value}
          </p>
          {trend && (
            <div className={cn("flex items-center gap-1 mt-1 text-xs", trend.value >= 0 ? "text-green-400" : "text-red-400")}>
              {trend.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ""}</span>
            </div>
          )}
          {subtext && <p className="text-xs text-text-muted mt-1">{subtext}</p>}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg" style={{ backgroundColor: color ? `${color}15` : "rgba(201,168,76,0.1)" }}>
            <Icon className="w-5 h-5" style={color ? { color } : { color: "#C9A84C" }} />
          </div>
        )}
      </div>
      {clickable && (
        <div className="flex items-center gap-1 mt-3 text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          <span>View all</span>
          <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  if (onClick) {
    return (
      <button onClick={onClick} className="block w-full text-left">
        {content}
      </button>
    );
  }

  return content;
}
