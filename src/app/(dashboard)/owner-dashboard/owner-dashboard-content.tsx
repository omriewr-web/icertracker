"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Users, DollarSign, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Scale, DoorOpen, ChevronUp, ChevronDown,
  CalendarClock, Activity,
} from "lucide-react";
import { useOwnerDashboard } from "@/hooks/use-owner-dashboard";
import KpiCard from "@/components/ui/kpi-card";
import ExportButton from "@/components/ui/export-button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { fmt$, pct } from "@/lib/utils";
import type { OwnerDashboardDTO } from "@/types";

// ── Helpers ───────────────────────────────────────────────────

function fmtRate(val: number | null): string {
  if (val === null) return "N/A";
  return `${val.toFixed(1)}%`;
}

type SortKey = "address" | "totalUnits" | "occupancyRate" | "arrears" | "openViolations" | "activeLegalCases";

// ── Component ─────────────────────────────────────────────────

export default function OwnerDashboardContent() {
  const { data, isLoading, isError } = useOwnerDashboard();
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("arrears");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedBuildings = useMemo(() => {
    if (!data) return [];
    return [...data.buildings].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [data, sortKey, sortDir]);

  if (isLoading) return <PageSkeleton />;
  if (isError || !data) return (
    <div className="flex flex-col items-center justify-center py-20 text-text-muted">
      <AlertTriangle className="w-10 h-10 mb-3 text-red-400" />
      <p className="text-lg font-medium">Failed to load dashboard</p>
      <p className="text-sm mt-1">Please try refreshing the page.</p>
    </div>
  );

  const p = data.portfolio;
  const trendIcon = p.arrearsTrend === "improving"
    ? <TrendingDown className="w-4 h-4 text-green-400" />
    : p.arrearsTrend === "worsening"
      ? <TrendingUp className="w-4 h-4 text-red-400" />
      : p.arrearsTrend === "flat"
        ? <Minus className="w-4 h-4 text-text-muted" />
        : null;

  const trendLabel = p.arrearsTrend === "improving" ? "Improving"
    : p.arrearsTrend === "worsening" ? "Worsening"
      : p.arrearsTrend === "flat" ? "Flat" : "N/A";

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 inline ml-0.5" />
      : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  return (
    <div className="space-y-6 animate-fade-in print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:mb-2">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Owner Dashboard</h1>
          <p className="text-xs text-text-dim mt-0.5">
            Portfolio performance report — {new Date(data.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="print:hidden">
          <ExportButton
            data={sortedBuildings.map((b) => ({
              address: b.address,
              totalUnits: b.totalUnits,
              occupancy: `${b.occupancyRate}%`,
              arrears: fmt$(b.arrears),
              violations: b.openViolations,
              legalCases: b.activeLegalCases,
            }))}
            filename="owner-portfolio-report"
            columns={[
              { key: "address", label: "Property" },
              { key: "totalUnits", label: "Units" },
              { key: "occupancy", label: "Occupancy" },
              { key: "arrears", label: "Arrears" },
              { key: "violations", label: "Violations" },
              { key: "legalCases", label: "Legal Cases" },
            ]}
            pdfConfig={{
              title: "Owner Portfolio Report",
              stats: [
                { label: "Total Units", value: String(p.totalUnits) },
                { label: "Occupancy", value: fmtRate(p.occupancyRate) },
                { label: "Monthly Rent", value: fmt$(p.totalMonthlyRent) },
                { label: "Total Arrears", value: fmt$(p.totalArrears) },
                { label: "Vacant Units", value: String(p.vacantUnits) },
                { label: "Legal Cases", value: String(data.legal.totalActive) },
              ],
            }}
          />
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Units" value={p.totalUnits} icon={Building2} color="#C9A84C" subtext={`${fmtRate(p.occupancyRate)} occupied`} />
        <KpiCard label="Occupied" value={p.occupiedUnits} icon={Users} color="#C9A84C" />
        <KpiCard label="Vacant" value={p.vacantUnits} icon={DoorOpen} color={p.vacantUnits > 0 ? "#e09a3e" : "#C9A84C"} subtext={p.vacantUnits > 0 ? `${fmt$(data.vacancies.estimatedLostRent)}/mo lost` : undefined} subtextColor="#e05c5c" />
        <KpiCard label="Monthly Rent" value={fmt$(p.totalMonthlyRent)} icon={DollarSign} color="#C9A84C" />
        <KpiCard label="Total Arrears" value={fmt$(p.totalArrears)} icon={DollarSign} color={p.totalArrears >= 100000 ? "#e05c5c" : "#C9A84C"} />
        <KpiCard label="Legal Cases" value={data.legal.totalActive} icon={Scale} color="#C9A84C" subtext={data.legal.totalBalance > 0 ? `${fmt$(data.legal.totalBalance)} in legal` : undefined} />
      </div>

      {/* Collections & Arrears + Vacancies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Arrears Breakdown */}
        <div className="bg-card-gradient border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text-muted">Collections & Arrears</h3>
            {trendIcon && (
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                {trendIcon}
                <span>{trendLabel} vs prior month</span>
                {p.priorMonthArrears !== null && (
                  <span className="text-text-dim ml-1">({fmt$(p.priorMonthArrears)})</span>
                )}
              </div>
            )}
          </div>
          <ArrearsTable arrears={data.arrears} total={p.totalArrears} />
          {p.collectionRate === null && (
            <p className="text-xs text-text-dim mt-3">Collection rate: N/A — billing history not available</p>
          )}
        </div>

        {/* Vacancy Summary */}
        <div className="bg-card-gradient border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-4">Vacancy Summary</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <MiniStat label="Vacant Units" value={data.vacancies.count} />
            <MiniStat label="Vacancy Rate" value={fmtRate(data.vacancies.rate)} />
            <MiniStat label="Lost Rent / Mo" value={fmt$(data.vacancies.estimatedLostRent)} />
          </div>
          {data.vacancies.units.length > 0 ? (
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-dim border-b border-border">
                    <th className="text-left py-1.5 font-medium">Property</th>
                    <th className="text-left py-1.5 font-medium">Unit</th>
                    <th className="text-right py-1.5 font-medium">Days</th>
                    <th className="text-right py-1.5 font-medium">Lost/Mo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vacancies.units.slice(0, 20).map((v, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 text-text-primary truncate max-w-[180px]">{v.buildingAddress}</td>
                      <td className="py-1.5 text-text-muted">{v.unitNumber}</td>
                      <td className="py-1.5 text-right text-text-muted">{v.daysVacant}</td>
                      <td className="py-1.5 text-right text-text-primary">{v.estimatedLostRent > 0 ? fmt$(v.estimatedLostRent) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-dim text-center py-6">No vacant units</p>
          )}
        </div>
      </div>

      {/* Violations & Legal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Violations */}
        <div className="bg-card-gradient border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-4">Violations & Compliance</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <MiniStat label="Total Open" value={data.violations.totalOpen} />
            <MiniStat label="Class A" value={data.violations.classA} color={data.violations.classA > 0 ? "#e05c5c" : undefined} />
            <MiniStat label="Class B" value={data.violations.classB} color={data.violations.classB > 0 ? "#e09a3e" : undefined} />
            <MiniStat label="Class C" value={data.violations.classC} color={data.violations.classC > 0 ? "#e05c5c" : undefined} />
          </div>
          {data.violations.pastCureDate > 0 && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-xs text-red-300">{data.violations.pastCureDate} violation{data.violations.pastCureDate !== 1 ? "s" : ""} past cure date</span>
            </div>
          )}
          {data.violations.topBuildings.length > 0 && (
            <div>
              <p className="text-xs text-text-dim mb-2">Most violations by building</p>
              {data.violations.topBuildings.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-1 text-xs">
                  <span className="text-text-primary truncate max-w-[260px]">{b.address}</span>
                  <span className="text-text-muted font-mono">{b.count}</span>
                </div>
              ))}
            </div>
          )}
          {data.violations.totalOpen === 0 && (
            <p className="text-sm text-text-dim text-center py-4">No open violations</p>
          )}
        </div>

        {/* Legal */}
        <div className="bg-card-gradient border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-4">Legal Cases</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <MiniStat label="Active Cases" value={data.legal.totalActive} />
            <MiniStat label="Balance in Legal" value={fmt$(data.legal.totalBalance)} />
          </div>
          {Object.keys(data.legal.byStage).length > 0 ? (
            <div>
              <p className="text-xs text-text-dim mb-2">By stage</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {Object.entries(data.legal.byStage)
                  .sort(([, a], [, b]) => b - a)
                  .map(([stage, count]) => (
                    <div key={stage} className="flex items-center justify-between py-1 text-xs">
                      <span className="text-text-primary capitalize">{stage.replace(/-/g, " ")}</span>
                      <span className="text-text-muted font-mono">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-dim text-center py-4">No active legal cases</p>
          )}
        </div>
      </div>

      {/* Upcoming Renewals & Vacancy Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Renewals */}
        <div className="bg-card-gradient border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-4 flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            Upcoming Renewals (90 days)
          </h3>
          {data.renewals.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-dim border-b border-border">
                    <th className="text-left py-1.5 font-medium">Tenant</th>
                    <th className="text-left py-1.5 font-medium">Unit</th>
                    <th className="text-right py-1.5 font-medium">Days</th>
                    <th className="text-right py-1.5 font-medium">Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.renewals.map((r) => (
                    <tr key={r.tenantId} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 text-text-primary truncate max-w-[120px]">{r.tenantName}</td>
                      <td className="py-1.5 text-text-muted">
                        <span className="truncate max-w-[100px] inline-block">{r.buildingAddress}</span>
                        <span className="text-text-dim ml-1">#{r.unitNumber}</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        <span className={r.daysUntilExpiry <= 30 ? "text-red-400 font-medium" : r.daysUntilExpiry <= 60 ? "text-orange-400" : "text-text-muted"}>
                          {r.daysUntilExpiry}
                        </span>
                      </td>
                      <td className="py-1.5 text-right text-text-primary tabular-nums">{fmt$(r.currentRent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-dim text-center py-6">No leases expiring in the next 90 days</p>
          )}
        </div>

        {/* Vacancy Pipeline */}
        <div className="bg-card-gradient border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Vacancy Pipeline
          </h3>
          {data.vacancyPipeline.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-dim border-b border-border">
                    <th className="text-left py-1.5 font-medium">Unit</th>
                    <th className="text-right py-1.5 font-medium">Asking</th>
                    <th className="text-right py-1.5 font-medium">Days</th>
                    <th className="text-right py-1.5 font-medium">Activity</th>
                    <th className="text-left py-1.5 font-medium">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vacancyPipeline.map((v) => (
                    <tr key={v.unitId} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 text-text-primary">
                        <span className="truncate max-w-[100px] inline-block">{v.buildingAddress}</span>
                        <span className="text-text-dim ml-1">#{v.unitNumber}</span>
                      </td>
                      <td className="py-1.5 text-right text-text-muted tabular-nums">{v.askingRent ? fmt$(v.askingRent) : "—"}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        <span className={v.daysVacant >= 60 ? "text-red-400" : v.daysVacant >= 30 ? "text-orange-400" : "text-text-muted"}>
                          {v.daysVacant}
                        </span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        <span className={v.recentActivityCount === 0 ? "text-red-400" : "text-text-muted"}>
                          {v.recentActivityCount}
                        </span>
                      </td>
                      <td className="py-1.5 text-text-dim">
                        {v.lastActivityDate
                          ? `${v.lastActivityType} — ${new Date(v.lastActivityDate).toLocaleDateString()}`
                          : "No activity"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-dim text-center py-6">No vacant units</p>
          )}
        </div>
      </div>

      {/* Per-Building Table */}
      {sortedBuildings.length > 0 && (
        <div className="bg-card-gradient border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-muted mb-4">Property Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-dim border-b border-border text-xs">
                  <SortableHeader label="Property" col="address" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Units" col="totalUnits" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <SortableHeader label="Occupancy" col="occupancyRate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <SortableHeader label="Arrears" col="arrears" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <SortableHeader label="Violations" col="openViolations" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <SortableHeader label="Legal" col="activeLegalCases" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedBuildings.map((b, i) => (
                  <tr
                    key={b.id}
                    className={`border-b border-border/50 last:border-0 cursor-pointer hover:bg-card-hover transition-colors ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}
                    onClick={() => router.push(`/data?building=${b.id}`)}
                  >
                    <td className="py-2.5 text-text-primary font-medium">{b.address}</td>
                    <td className="py-2.5 text-right text-text-muted tabular-nums">{b.totalUnits}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      <span className={b.occupancyRate < 80 ? "text-red-400" : b.occupancyRate < 90 ? "text-orange-400" : "text-text-primary"}>
                        {b.occupancyRate}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      <span className={b.arrears > 50000 ? "text-red-400" : b.arrears > 10000 ? "text-orange-400" : "text-text-primary"}>
                        {fmt$(b.arrears)}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      <span className={b.openViolations > 10 ? "text-red-400" : b.openViolations > 0 ? "text-orange-400" : "text-text-muted"}>
                        {b.openViolations}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      <span className={b.activeLegalCases > 0 ? "text-orange-400" : "text-text-muted"}>
                        {b.activeLegalCases}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-xs text-text-dim">{label}</p>
      <p className="text-lg font-bold font-mono tabular-nums mt-0.5" style={color ? { color } : undefined}>{value}</p>
    </div>
  );
}

function ArrearsTable({ arrears, total }: { arrears: OwnerDashboardDTO["arrears"]; total: number }) {
  const rows = [
    { label: "Current", ...arrears.current },
    { label: "30 Days", ...arrears.d30 },
    { label: "60 Days", ...arrears.d60 },
    { label: "90 Days", ...arrears.d90 },
    { label: "120+ Days", ...arrears.d120plus },
  ];

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-text-dim border-b border-border">
          <th className="text-left py-1.5 font-medium">Bucket</th>
          <th className="text-right py-1.5 font-medium">Tenants</th>
          <th className="text-right py-1.5 font-medium">Amount</th>
          <th className="text-right py-1.5 font-medium">% of Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-border/50 last:border-0">
            <td className="py-1.5 text-text-primary">{r.label}</td>
            <td className="py-1.5 text-right text-text-muted tabular-nums">{r.count}</td>
            <td className="py-1.5 text-right text-text-primary tabular-nums">{fmt$(r.amount)}</td>
            <td className="py-1.5 text-right text-text-muted tabular-nums">
              {total > 0 ? `${((r.amount / total) * 100).toFixed(1)}%` : "—"}
            </td>
          </tr>
        ))}
        <tr className="border-t border-border font-medium">
          <td className="py-1.5 text-text-primary">Total</td>
          <td className="py-1.5 text-right text-text-muted tabular-nums">
            {rows.reduce((s, r) => s + r.count, 0)}
          </td>
          <td className="py-1.5 text-right text-accent tabular-nums">{fmt$(total)}</td>
          <td className="py-1.5 text-right text-text-muted">100%</td>
        </tr>
      </tbody>
    </table>
  );
}

function SortableHeader({
  label, col, sortKey, sortDir, onSort, align = "left",
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (col: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === col;
  return (
    <th
      className={`py-2 font-medium cursor-pointer select-none hover:text-text-primary transition-colors ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => onSort(col)}
    >
      <span className={active ? "text-accent" : ""}>
        {label}
        {active && (sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />)}
      </span>
    </th>
  );
}
