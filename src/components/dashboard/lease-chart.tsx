"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from "recharts";
import { useAppStore } from "@/stores/app-store";

const COLORS = ["#10B981", "#F59E0B", "#EF4444", "#6B7280"];
const FILTER_KEYS = ["active", "expiring-soon", "expired", "no-lease"] as const;

interface Props {
  active: number;
  expiringSoon: number;
  expired: number;
  noLease: number;
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

export default function LeaseChart({ active, expiringSoon, expired, noLease }: Props) {
  const router = useRouter();
  const { setLeaseFilter } = useAppStore();
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const raw = [
    { name: "Active", value: Math.max(0, active), color: COLORS[0], filterKey: FILTER_KEYS[0] },
    { name: "Expiring Soon", value: expiringSoon, color: COLORS[1], filterKey: FILTER_KEYS[1] },
    { name: "Expired", value: expired, color: COLORS[2], filterKey: FILTER_KEYS[2] },
    { name: "No Lease", value: noLease, color: COLORS[3], filterKey: FILTER_KEYS[3] },
  ];
  const data = raw.filter((d) => d.value > 0);

  const navigate = useCallback((filterKey: string) => {
    setLeaseFilter(filterKey);
    router.push("/leases");
  }, [setLeaseFilter, router]);

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
              <linearGradient key={i} id={`lease-gradient-${i}`} x1="0" y1="0" x2="1" y2="1">
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
              return <Cell key={i} fill={`url(#lease-gradient-${colorIndex})`} stroke="none" />;
            })}
          </Pie>
          <Tooltip
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
              {item.name} <span className="font-semibold text-text-primary">{item.value}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
