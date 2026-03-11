"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { BuildingView } from "@/types";
import { fmt$ } from "@/lib/utils";

interface Props {
  buildings: BuildingView[];
}

function fmtShort(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const total = d.legalBalance + d.nonLegalBalance;
  const legalPct = total > 0 ? ((d.legalBalance / total) * 100).toFixed(1) : "0";
  const nonLegalPct = total > 0 ? ((d.nonLegalBalance / total) * 100).toFixed(1) : "0";

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #141A24, #1A2232)",
        border: "1px solid #2A3441",
        borderRadius: 12,
        padding: "12px 16px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        minWidth: 220,
      }}
    >
      <p className="text-sm font-semibold text-text-primary mb-2">{d.fullAddress}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-text-muted">Total Balance</span>
          <span className="text-text-primary font-mono font-semibold">{fmt$(total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-red-400">In Legal</span>
          <span className="text-red-400 font-mono">{fmt$(d.legalBalance)} ({legalPct}%)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-amber-400">Not in Legal</span>
          <span className="text-amber-400 font-mono">{fmt$(d.nonLegalBalance)} ({nonLegalPct}%)</span>
        </div>
        <hr className="border-border my-1" />
        <div className="flex justify-between">
          <span className="text-text-muted">Tenants in Arrears</span>
          <span className="text-text-primary">{d.arrearsCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">In Legal</span>
          <span className="text-text-primary">{d.legalCount}</span>
        </div>
      </div>
    </div>
  );
}

function CustomLabel(props: any) {
  const { x, y, width, height, payload } = props;
  const total = payload?.total;
  if (!total || total <= 0) return null;
  // x + width is end of the last stacked segment
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      fill="#8899AA"
      fontSize={10}
      fontFamily="JetBrains Mono, monospace"
      dominantBaseline="central"
    >
      {fmtShort(total)}
    </text>
  );
}

export default function BalanceChart({ buildings }: Props) {
  const data = buildings.slice(0, 10).map((b) => ({
    name: b.address,
    fullAddress: b.address,
    legalBalance: b.legalBalance || 0,
    nonLegalBalance: b.nonLegalBalance || 0,
    total: b.totalBalance,
    arrearsCount: b.arrearsCount || 0,
    legalCount: b.legalCount || 0,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(400, data.length * 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 70 }}>
          <defs>
            <linearGradient id="legal-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#e05c5c" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#e05c5c" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="nonlegal-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#D4B95E" stopOpacity={0.9} />
            </linearGradient>
          </defs>
          <XAxis
            type="number"
            tickFormatter={(v) => fmtShort(v)}
            tick={{ fill: "#8899AA", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={200}
            tick={{ fill: "#E8ECF1", fontSize: 11, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar
            dataKey="nonLegalBalance"
            stackId="balance"
            fill="url(#nonlegal-gradient)"
            radius={[0, 0, 0, 0]}
            name="Not in Legal"
          />
          <Bar
            dataKey="legalBalance"
            stackId="balance"
            fill="url(#legal-gradient)"
            radius={[0, 4, 4, 0]}
            name="In Legal"
            label={<CustomLabel />}
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#e05c5c" }} />
          <span className="text-text-muted">In Legal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#C9A84C" }} />
          <span className="text-text-muted">Not in Legal</span>
        </div>
      </div>
    </div>
  );
}
