"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";
import KpiCard from "@/components/ui/kpi-card";
import DataTable, { Column } from "@/components/ui/data-table";
import ExportButton from "@/components/ui/export-button";
import { DollarSign, Users, Building2, Scale } from "lucide-react";

// ── Types ──

interface AgingSummary {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days120Plus: number;
  totalBalance: number;
  currentCount: number;
  days30Count: number;
  days60Count: number;
  days90Count: number;
  days120PlusCount: number;
  totalRent: number;
  tenantCount: number;
  buildingCount: number;
  inLegalCount: number;
}

interface BuildingRow {
  id: string;
  address: string;
  portfolio: string | null;
  region: string | null;
  tenantCount: number;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days120Plus: number;
  totalBalance: number;
  currentCount: number;
  days30Count: number;
  days60Count: number;
  days90Count: number;
  days120PlusCount: number;
}

interface ARReportResponse {
  summary: AgingSummary;
  buildings: BuildingRow[];
}

// ── Helpers ──

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtFull(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function pct(part: number, total: number) {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

// ── Component ──

export default function ARReportContent() {
  const { selectedBuildingId } = useAppStore();
  const [sortField, setSortField] = useState("totalBalance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [portfolioFilter, setPortfolioFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery<ARReportResponse>({
    queryKey: ["collections", "report", selectedBuildingId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBuildingId) params.set("buildingId", selectedBuildingId);
      const res = await fetch(`/api/collections/report?${params}`);
      if (!res.ok) throw new Error("Failed to fetch AR report");
      return res.json();
    },
  });

  const portfolios = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.buildings.map((b) => b.portfolio).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [data]);

  const filteredBuildings = useMemo(() => {
    if (!data) return [];
    let rows = data.buildings;
    if (portfolioFilter !== "all") {
      rows = rows.filter((b) => b.portfolio === portfolioFilter);
    }
    rows.sort((a, b) => {
      const aVal = (a as any)[sortField] ?? 0;
      const bVal = (b as any)[sortField] ?? 0;
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return rows;
  }, [data, portfolioFilter, sortField, sortDir]);

  const exportData = useMemo(() => {
    return filteredBuildings.map((b) => ({
      Address: b.address,
      Portfolio: b.portfolio || "",
      Region: b.region || "",
      Tenants: b.tenantCount,
      Current: b.current,
      "30 Days": b.days30,
      "60 Days": b.days60,
      "90 Days": b.days90,
      "120+ Days": b.days120Plus,
      "Total Balance": b.totalBalance,
    }));
  }, [filteredBuildings]);

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-text-dim">
        Failed to load AR report. Please try again.
      </div>
    );
  }

  const summary = data?.summary;

  const columns: Column<BuildingRow>[] = [
    {
      key: "address",
      label: "Building",
      sortable: true,
      className: "min-w-[200px]",
      render: (row) => (
        <div>
          <p className="text-text-primary font-medium text-xs">{row.address}</p>
          {row.portfolio && <p className="text-[10px] text-text-dim">{row.portfolio}</p>}
        </div>
      ),
    },
    {
      key: "tenantCount",
      label: "Tenants",
      sortable: true,
      className: "text-right w-20",
      render: (row) => <span className="text-text-muted tabular-nums font-data">{row.tenantCount}</span>,
    },
    {
      key: "current",
      label: "Current",
      sortable: true,
      className: "text-right w-28",
      render: (row) => <AgingCell amount={row.current} count={row.currentCount} />,
    },
    {
      key: "days30",
      label: "30 Days",
      sortable: true,
      className: "text-right w-28",
      render: (row) => <AgingCell amount={row.days30} count={row.days30Count} severity="warning" />,
    },
    {
      key: "days60",
      label: "60 Days",
      sortable: true,
      className: "text-right w-28",
      render: (row) => <AgingCell amount={row.days60} count={row.days60Count} severity="warning" />,
    },
    {
      key: "days90",
      label: "90 Days",
      sortable: true,
      className: "text-right w-28",
      render: (row) => <AgingCell amount={row.days90} count={row.days90Count} severity="danger" />,
    },
    {
      key: "days120Plus",
      label: "120+",
      sortable: true,
      className: "text-right w-28",
      render: (row) => <AgingCell amount={row.days120Plus} count={row.days120PlusCount} severity="danger" />,
    },
    {
      key: "totalBalance",
      label: "Total",
      sortable: true,
      className: "text-right w-32",
      render: (row) => (
        <span className="text-text-primary font-bold tabular-nums font-data text-xs">
          {fmt(row.totalBalance)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary font-heading">AR Aging Report</h1>
          <p className="text-xs text-text-dim mt-0.5">Accounts receivable breakdown by building and aging bucket</p>
        </div>
        <ExportButton
          data={exportData}
          filename="ar-aging-report"
          formats={["csv", "xlsx", "pdf"]}
          columns={[
            { key: "Address", label: "Building" },
            { key: "Portfolio", label: "Portfolio" },
            { key: "Tenants", label: "Tenants" },
            { key: "Current", label: "Current" },
            { key: "30 Days", label: "30 Days" },
            { key: "60 Days", label: "60 Days" },
            { key: "90 Days", label: "90 Days" },
            { key: "120+ Days", label: "120+ Days" },
            { key: "Total Balance", label: "Total Balance" },
          ]}
          pdfConfig={{ title: "AR Aging Report" }}
        />
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-atlas-navy-3 border border-border rounded-lg p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            label="Total AR Balance"
            value={fmt(summary.totalBalance)}
            subtext={`${summary.tenantCount} tenants across ${summary.buildingCount} buildings`}
            icon={DollarSign}
            color="#e05c5c"
            href="/collections"
          />
          <KpiCard
            label="Past Due (30+)"
            value={fmt(summary.days30 + summary.days60 + summary.days90 + summary.days120Plus)}
            subtext={`${summary.days30Count + summary.days60Count + summary.days90Count + summary.days120PlusCount} tenants`}
            icon={Users}
            color="#e09a3e"
            href="/collections"
          />
          <KpiCard
            label="Severely Delinquent (90+)"
            value={fmt(summary.days90 + summary.days120Plus)}
            subtext={`${pct(summary.days90 + summary.days120Plus, summary.totalBalance)} of total AR`}
            icon={Building2}
            color="#e05c5c"
            href="/collections"
          />
          <KpiCard
            label="In Legal / High Risk"
            value={summary.inLegalCount}
            subtext={`${pct(summary.inLegalCount, summary.tenantCount)} of tenants`}
            icon={Scale}
            color="#e05c5c"
            href="/legal"
          />
        </div>
      ) : null}

      {/* Aging Summary Bar */}
      {summary && summary.totalBalance > 0 && (
        <div className="bg-atlas-navy-3 border border-border rounded-lg p-4">
          <p className="text-[10px] text-text-dim uppercase tracking-[0.15em] font-medium mb-3">Aging Distribution</p>
          <div className="flex h-6 rounded overflow-hidden">
            <AgingBar label="Current" amount={summary.current} total={summary.totalBalance} color="#4caf82" />
            <AgingBar label="30d" amount={summary.days30} total={summary.totalBalance} color="#e09a3e" />
            <AgingBar label="60d" amount={summary.days60} total={summary.totalBalance} color="#d4783e" />
            <AgingBar label="90d" amount={summary.days90} total={summary.totalBalance} color="#e05c5c" />
            <AgingBar label="120+" amount={summary.days120Plus} total={summary.totalBalance} color="#b83c3c" />
          </div>
          <div className="flex flex-wrap gap-4 mt-2">
            <AgingLegend label="Current" amount={summary.current} total={summary.totalBalance} color="#4caf82" count={summary.currentCount} />
            <AgingLegend label="30 Days" amount={summary.days30} total={summary.totalBalance} color="#e09a3e" count={summary.days30Count} />
            <AgingLegend label="60 Days" amount={summary.days60} total={summary.totalBalance} color="#d4783e" count={summary.days60Count} />
            <AgingLegend label="90 Days" amount={summary.days90} total={summary.totalBalance} color="#e05c5c" count={summary.days90Count} />
            <AgingLegend label="120+ Days" amount={summary.days120Plus} total={summary.totalBalance} color="#b83c3c" count={summary.days120PlusCount} />
          </div>
        </div>
      )}

      {/* Filter row */}
      {portfolios.length > 1 && (
        <div className="flex items-center gap-3">
          <select
            value={portfolioFilter}
            onChange={(e) => setPortfolioFilter(e.target.value)}
            className="bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="all">All Portfolios</option>
            {portfolios.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <span className="text-xs text-text-dim">{filteredBuildings.length} buildings</span>
        </div>
      )}

      {/* Building Table */}
      <div className="bg-atlas-navy-3 border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-text-dim animate-pulse">Loading AR data...</div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredBuildings}
            rowKey={(row) => row.id}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            emptyMessage="No buildings with outstanding balances"
          />
        )}

        {/* Totals row */}
        {!isLoading && filteredBuildings.length > 0 && (
          <div className="border-t border-border bg-[#0d1526] px-3 py-2.5 flex items-center">
            <span className="text-xs font-bold text-text-primary min-w-[200px]">
              TOTAL ({filteredBuildings.length} buildings)
            </span>
            <div className="flex-1 flex justify-end gap-0">
              {["tenantCount", "current", "days30", "days60", "days90", "days120Plus", "totalBalance"].map((field) => {
                const total = filteredBuildings.reduce((s, b) => s + ((b as any)[field] ?? 0), 0);
                return (
                  <span key={field} className="text-xs font-bold tabular-nums font-data text-text-primary text-right w-28">
                    {field === "tenantCount" ? (
                      <span className="w-20 inline-block text-right">{total}</span>
                    ) : (
                      fmt(total)
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function AgingCell({ amount, count, severity }: { amount: number; count: number; severity?: "warning" | "danger" }) {
  if (amount === 0 && count === 0) return <span className="text-text-dim text-xs">—</span>;

  const color =
    severity === "danger" ? "text-atlas-red" :
    severity === "warning" ? "text-atlas-amber" :
    "text-text-muted";

  return (
    <div className="text-right">
      <p className={`text-xs tabular-nums font-data font-medium ${color}`}>{fmt(amount)}</p>
      <p className="text-[10px] text-text-dim">{count} tenant{count !== 1 ? "s" : ""}</p>
    </div>
  );
}

function AgingBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const width = total > 0 ? (amount / total) * 100 : 0;
  if (width < 1) return null;
  return (
    <div
      className="flex items-center justify-center text-[9px] font-medium text-white/90 transition-all"
      style={{ width: `${width}%`, backgroundColor: color, minWidth: width > 5 ? "auto" : 0 }}
      title={`${label}: ${fmt(amount)} (${pct(amount, total)})`}
    >
      {width > 8 && label}
    </div>
  );
}

function AgingLegend({ label, amount, total, color, count }: { label: string; amount: number; total: number; color: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-text-dim">{label}:</span>
      <span className="text-text-primary font-data tabular-nums">{fmt(amount)}</span>
      <span className="text-text-dim">({pct(amount, total)}, {count})</span>
    </div>
  );
}
