"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BuildingView } from "@/types";
import { fmt$ } from "@/lib/utils";

interface Props {
  buildings: BuildingView[];
}

export default function BalanceChart({ buildings }: Props) {
  const data = buildings.map((b) => ({
    name: b.address.length > 20 ? b.address.slice(0, 20) + "..." : b.address,
    balance: b.totalBalance,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(250, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <defs>
          <linearGradient id="balance-bar-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#D4B95E" stopOpacity={0.9} />
          </linearGradient>
        </defs>
        <XAxis type="number" tickFormatter={(v) => fmt$(v)} tick={{ fill: "#8899AA", fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={150} tick={{ fill: "#8899AA", fontSize: 11 }} />
        <Tooltip
          formatter={(v: number) => fmt$(v)}
          contentStyle={{
            background: "linear-gradient(135deg, #141A24, #1A2232)",
            border: "1px solid #2A3441",
            borderRadius: 12,
            color: "#E8ECF1",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        />
        <Bar dataKey="balance" fill="url(#balance-bar-gradient)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
