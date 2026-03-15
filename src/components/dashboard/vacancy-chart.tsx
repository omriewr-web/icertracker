"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BuildingView } from "@/types";

interface Props {
  buildings: BuildingView[];
}

export default function VacancyChart({ buildings }: Props) {
  const data = buildings
    .filter((b) => b.vacant > 0)
    .sort((a, b) => b.vacant - a.vacant)
    .slice(0, 12)
    .map((b) => ({
      name: b.address.length > 20 ? b.address.slice(0, 18) + "…" : b.address,
      vacant: b.vacant,
      total: b.totalUnits,
      rate: b.totalUnits > 0 ? Math.round((b.vacant / b.totalUnits) * 100) : 0,
    }));

  if (data.length === 0) {
    return <p className="text-text-dim text-sm text-center py-8">No vacancies to chart</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <XAxis type="number" tick={{ fill: "#5a7a9a", fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fill: "#5a7a9a", fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{ background: "linear-gradient(135deg, #0a1628, #0f2337)", border: "1px solid #1e3a5f", borderRadius: 12, color: "#e8edf4", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
          formatter={(value: number, name: string, props: any) => [
            `${value} units (${props.payload.rate}%)`,
            "Vacant",
          ]}
        />
        <Bar dataKey="vacant" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.rate >= 30 ? "#e05c5c" : entry.rate >= 15 ? "#e09a3e" : "#3b82f6"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
