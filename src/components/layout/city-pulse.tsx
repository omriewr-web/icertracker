"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

interface PulseItem {
  id: string;
  text: string;
  severity: "critical" | "high" | "medium" | "low";
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-atlas-red",
  high: "text-atlas-amber",
  medium: "text-atlas-blue",
  low: "text-text-dim",
};

export default function CityPulse() {
  const [items, setItems] = useState<PulseItem[]>([]);

  useEffect(() => {
    async function fetchSignals() {
      try {
        const res = await fetch("/api/signals?status=active");
        if (!res.ok) return;
        const data = await res.json();
        const signals = (data.signals || []).slice(0, 10).map((s: any) => ({
          id: s.id,
          text: `${s.severity.toUpperCase()}: ${s.title || s.type} — ${s.buildingAddress || "Portfolio"}`,
          severity: s.severity,
        }));
        setItems(signals);
      } catch {
        // Silent fail — ticker is non-critical
      }
    }
    fetchSignals();
    const interval = setInterval(fetchSignals, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (items.length === 0) return null;

  const tickerText = items.map((i) => i.text).join("   ·   ");

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[34px] bg-atlas-navy-2 border-t border-border z-50 flex items-center overflow-hidden">
      <div className="flex items-center gap-2 px-3 shrink-0 border-r border-border h-full">
        <Activity className="w-3 h-3 text-accent animate-atlas-live-blink" />
        <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-accent">City Pulse</span>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="animate-atlas-ticker whitespace-nowrap">
          <span className="text-xs text-text-dim font-data">
            {items.map((item, i) => (
              <span key={item.id}>
                <span className={SEVERITY_COLORS[item.severity]}>{item.text}</span>
                {i < items.length - 1 && <span className="text-border mx-3">·</span>}
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
