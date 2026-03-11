"use client";

import { useMemo } from "react";
import { DoorOpen } from "lucide-react";
import { useBuildings } from "@/hooks/use-buildings";
import { useMetrics } from "@/hooks/use-metrics";
import StatCard from "@/components/ui/stat-card";
import { PageSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import VacancyChart from "@/components/dashboard/vacancy-chart";
import { fmt$, pct } from "@/lib/utils";
import ExportButton from "@/components/ui/export-button";

export default function VacanciesContent() {
  const { data: buildings, isLoading } = useBuildings();
  const { data: metrics } = useMetrics();

  const buildingsWithVacancies = useMemo(
    () => (buildings || []).filter((b) => b.vacant > 0).sort((a, b) => b.vacant - a.vacant),
    [buildings]
  );

  const totalVacantRent = useMemo(
    () => metrics?.lostRent || 0,
    [metrics]
  );

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Vacancy Tracking</h1>
        <ExportButton
          data={buildingsWithVacancies.map((b) => ({
            address: b.address,
            totalUnits: b.totalUnits,
            occupied: b.occupied,
            vacant: b.vacant,
            vacancyRate: b.totalUnits > 0 ? ((b.vacant / b.totalUnits) * 100).toFixed(1) + "%" : "0%",
            totalMarketRent: b.totalMarketRent,
          }))}
          filename="vacancy-report"
          columns={[
            { key: "address", label: "Property" },
            { key: "totalUnits", label: "Total Units" },
            { key: "occupied", label: "Occupied" },
            { key: "vacant", label: "Vacant" },
            { key: "vacancyRate", label: "Vacancy Rate" },
            { key: "totalMarketRent", label: "Market Rent" },
          ]}
          pdfConfig={{
            title: "Vacancy Report",
            stats: [
              { label: "Vacant Units", value: String(metrics?.vacant || 0) },
              { label: "Vacancy Rate", value: metrics?.totalUnits ? pct(((metrics?.vacant || 0) / metrics.totalUnits) * 100) : "0%" },
              { label: "Lost Rent/Mo", value: fmt$(totalVacantRent) },
            ],
          }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Vacant Units" value={metrics?.vacant || 0} icon={DoorOpen} color="#F59E0B" />
        <StatCard label="Total Units" value={metrics?.totalUnits || 0} />
        <StatCard label="Vacancy Rate" value={metrics?.totalUnits ? pct(((metrics?.vacant || 0) / metrics.totalUnits) * 100) : "0%"} color="#F59E0B" />
        <StatCard label="Lost Rent/Mo" value={fmt$(totalVacantRent)} color="#EF4444" />
      </div>

      {buildingsWithVacancies.length > 0 && (
        <div className="bg-card-gradient border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-4">Vacancies by Property</h3>
          <VacancyChart buildings={buildingsWithVacancies} />
        </div>
      )}

      {buildingsWithVacancies.length > 0 ? (
        <div className="bg-card-gradient border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Property</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Total</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Occupied</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Vacant</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Vacancy Rate</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Market Rent</th>
              </tr>
            </thead>
            <tbody>
              {buildingsWithVacancies.map((b) => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                  <td className="px-3 py-2 text-text-primary">{b.address}</td>
                  <td className="px-3 py-2 text-right text-text-muted font-mono">{b.totalUnits}</td>
                  <td className="px-3 py-2 text-right text-green-400 font-mono">{b.occupied}</td>
                  <td className="px-3 py-2 text-right text-amber-400 font-bold font-mono">{b.vacant}</td>
                  <td className="px-3 py-2 text-right text-amber-400 font-mono">
                    {b.totalUnits > 0 ? pct((b.vacant / b.totalUnits) * 100) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-text-muted font-mono">{fmt$(b.totalMarketRent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No vacancies" description="All units are currently occupied" icon={DoorOpen} />
      )}
    </div>
  );
}
