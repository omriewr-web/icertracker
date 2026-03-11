"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from "recharts";
import { useAppStore } from "@/stores/app-store";

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444"];
const FILTER_KEYS = ["current", "30", "60", "90"] as const;

function fmtShort(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

interface Props {
  current: number;
  d30: number;
  d60: number;
  d90plus: number;
  current$?: number;
  d30$?: number;
  d60$?: number;
  d90plus$?: number;
}

function ActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius - 2}
      outerRadius={outerRadius + 4}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      style={{ filter: "brightness(1.25)", cursor: "pointer" }}
    />
  );
}

export default function ArrearsChart({ current, d30, d60, d90plus, current$, d30$, d60$, d90plus$ }: Props) {
  const router = useRouter();
  const { setArrearsFilter } = useAppStore();
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const raw = [
    { name: "Current", value: Math.max(0, current), dollars: current$ ?? 0, color: COLORS[0], filterKey: FILTER_KEYS[0] },
    { name: "30 Days", value: d30, dollars: d30$ ?? 0, color: COLORS[1], filterKey: FILTER_KEYS[1] },
    { name: "60 Days", value: d60, dollars: d60$ ?? 0, color: COLORS[2], filterKey: FILTER_KEYS[2] },
    { name: "90+ Days", value: d90plus, dollars: d90plus$ ?? 0, color: COLORS[3], filterKey: FILTER_KEYS[3] },
  ];
  const data = raw.filter((d) => d.value > 0);

  const navigate = useCallback((filterKey: string) => {
    setArrearsFilter(filterKey);
    router.push("/alerts");
  }, [setArrearsFilter, router]);

  const handleClick = useCallback((_: any, index: number) => {
    const item = data[index];
    if (item) {
      const rawItem = raw.find((r) => r.name === item.name);
      if (rawItem) navigate(rawItem.filterKey);
    }
  }, [data, raw, navigate]);

  if (data.length === 0) {
    return <p className="text-text-dim text-sm text-center py-8">No data</p>;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <defs>
            {COLORS.map((color, i) => (
              <linearGradient key={i} id={`arrears-gradient-${i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={color} stopOpacity={0.6} />
              </linearGradient>
            ))}
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            dataKey="value"
            paddingAngle={2}
            activeIndex={activeIndex}
            activeShape={ActiveShape}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
            onClick={handleClick}
            style={{ cursor: "pointer" }}
          >
            {data.map((entry, i) => {
              const colorIndex = raw.findIndex((r) => r.name === entry.name);
              return <Cell key={i} fill={`url(#arrears-gradient-${colorIndex})`} stroke="none" />;
            })}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value} tenants`, name]}
            contentStyle={{
              background: "linear-gradient(135deg, #141A24, #1A2232)",
              border: "1px solid #2A3441",
              borderRadius: 12,
              color: "#E8ECF1",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2">
        {raw.map((item) => (
          <button
            key={item.name}
            onClick={() => navigate(item.filterKey)}
            className="flex items-center gap-1.5 text-xs group cursor-pointer bg-transparent border-none p-0"
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-text-muted group-hover:underline group-hover:text-text-primary transition-colors">
              {item.name} <span className="font-mono text-text-primary">{fmtShort(item.dollars)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
