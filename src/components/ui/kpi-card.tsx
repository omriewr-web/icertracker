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
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(ease * ref.current));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  subtextColor?: string;
  icon?: LucideIcon;
  color?: string;
  className?: string;
  href?: string;
  onClick?: () => void;
  trend?: { value: number; label?: string };
}

export default function KpiCard({
  label, value, subtext, subtextColor, icon: Icon, color, className, href, onClick, trend,
}: KpiCardProps) {
  const isNumeric = typeof value === "number";
  const countUpValue = useCountUp(isNumeric ? value : 0);
  const clickable = !!(href || onClick);

  const content = (
    <div
      className={cn(
        "bg-atlas-navy-3 border border-border rounded-lg p-4 group flex flex-col justify-between h-full relative overflow-hidden",
        clickable && "card-hover-lift cursor-pointer",
        className
      )}
    >
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ backgroundColor: color || "var(--atlas-gold)", opacity: 0.4 }} />

      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium">{label}</p>
          <p className="text-2xl font-bold font-data mt-1 tabular-nums" style={color ? { color } : { color: "var(--atlas-text)" }}>
            {isNumeric ? countUpValue : value}
          </p>
          {trend && (
            <div className={cn("flex items-center gap-1 mt-1 text-xs font-data", trend.value >= 0 ? "text-atlas-green" : "text-atlas-red")}>
              {trend.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ""}</span>
            </div>
          )}
          {subtext && <p className="text-xs mt-1 text-text-dim" style={subtextColor ? { color: subtextColor } : undefined}>{subtext}</p>}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg" style={{ backgroundColor: color ? `${color}15` : "rgba(201,168,76,0.1)" }}>
            <Icon className="w-5 h-5" style={color ? { color } : { color: "var(--atlas-gold)" }} />
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
    return <Link href={href} className="block h-full">{content}</Link>;
  }

  if (onClick) {
    return (
      <button onClick={onClick} className="block w-full h-full text-left">
        {content}
      </button>
    );
  }

  return content;
}
