"use client";

import { BuildingView } from "@/types";
import { fmt$, pct } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

interface Props {
  buildings: BuildingView[];
}

export default function PropertiesTable({ buildings }: Props) {
  const { setSelectedBuildingId } = useAppStore();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Property</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Units</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Occ.</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Vacant</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Balance</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Occupancy</th>
          </tr>
        </thead>
        <tbody>
          {buildings.map((b, index) => (
            <tr
              key={b.id}
              className={`border-b border-border/50 cursor-pointer transition-all border-l-2 border-l-transparent hover:bg-card-hover hover:border-l-accent ${index % 2 === 1 ? "bg-[#141A2240]" : ""}`}
              onClick={() => setSelectedBuildingId(b.id)}
            >
              <td className="px-3 py-2 text-text-primary">{b.address}</td>
              <td className="px-3 py-2 text-right text-text-muted tabular-nums">{b.totalUnits}</td>
              <td className="px-3 py-2 text-right text-green-400 tabular-nums">{b.occupied}</td>
              <td className="px-3 py-2 text-right text-amber-400 tabular-nums">{b.vacant}</td>
              <td className="px-3 py-2 text-right text-red-400 font-mono tabular-nums">{fmt$(b.totalBalance)}</td>
              <td className="px-3 py-2 text-right text-text-muted tabular-nums">
                {b.totalUnits > 0 ? pct((b.occupied / b.totalUnits) * 100) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
