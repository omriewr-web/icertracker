"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  AlertTriangle,
  Scale,
  CalendarCheck,
  Phone,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useCollectionsDashboard, useCollectionTenants, type ARTenantRow, type CollectionFilters } from "@/hooks/use-collections";
import { useBuildings } from "@/hooks/use-buildings";
import StatCard from "@/components/ui/stat-card";
import { PageSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import { fmt$, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import ExportButton from "@/components/ui/export-button";

// ── Aging badge ──

function AgingBadge({ category }: { category: string }) {
  if (category === "120+" || category === "90")
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-500/10 text-red-400">90+</span>;
  if (category === "60")
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-orange-500/10 text-orange-400">61-90</span>;
  if (category === "30")
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-yellow-500/10 text-yellow-400">31-60</span>;
  return <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-500/10 text-green-400">0-30</span>;
}

export default function CollectionsContent() {
  const router = useRouter();
  const [filters, setFilters] = useState<CollectionFilters>({});
  const [minBalanceInput, setMinBalanceInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [staleOpen, setStaleOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data: dashboard, isLoading: dashLoading } = useCollectionsDashboard();
  const { data: tenantsData, isLoading: tenantsLoading } = useCollectionTenants({
    ...filters,
    status: statusFilter || undefined,
    page,
    pageSize: 50,
  });
  const { data: buildings } = useBuildings();

  const isLoading = dashLoading && tenantsLoading;

  function handleBuildingFilter(buildingId: string) {
    setFilters((prev) => ({ ...prev, buildingId: buildingId || undefined }));
    setPage(1);
  }

  function applyMinBalance() {
    const mb = parseFloat(minBalanceInput);
    setFilters((prev) => ({ ...prev, minBalance: !isNaN(mb) && mb > 0 ? mb : undefined }));
    setPage(1);
  }

  const rows = tenantsData?.data ?? [];
  const totalPages = tenantsData ? Math.ceil(tenantsData.total / tenantsData.pageSize) : 1;

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Collections</h1>
        <ExportButton
          data={rows}
          filename="collections-ar-aging"
          columns={[
            { key: "name", label: "Tenant" },
            { key: "buildingAddress", label: "Building" },
            { key: "unitNumber", label: "Unit" },
            { key: "balance", label: "Balance" },
            { key: "arrearsCategory", label: "Aging" },
            { key: "inLegal", label: "In Legal" },
            { key: "lastNoteText", label: "Last Note" },
            { key: "lastNoteDate", label: "Note Date" },
          ]}
          pdfConfig={{
            title: "A/R Aging Report",
            stats: [
              { label: "Total AR Balance", value: fmt$(dashboard?.totalBalance ?? 0) },
              { label: "Non-Paying Tenants", value: String(dashboard?.tenantCount ?? 0) },
              { label: "In Legal", value: String(dashboard?.legalCount ?? 0) },
              { label: "Stale (30+ days)", value: String(dashboard?.staleCount ?? 0) },
            ],
          }}
        />
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total AR Balance"
          value={fmt$(dashboard?.totalBalance ?? 0)}
          icon={DollarSign}
          color="#e05c5c"
        />
        <StatCard
          label="Non-Paying Tenants"
          value={dashboard?.tenantCount ?? 0}
          icon={AlertTriangle}
          color="#e09a3e"
        />
        <StatCard
          label="In Legal"
          value={dashboard?.legalCount ?? 0}
          icon={Scale}
          color="#8B5CF6"
        />
        <StatCard
          label="Follow-Ups Due"
          value={dashboard?.staleCount ?? 0}
          subtext="No notes in 30+ days"
          icon={Phone}
          color="#3B82F6"
        />
      </div>

      {/* ── Stale Tenants Alert ── */}
      {(dashboard?.staleCount ?? 0) > 0 && (
        <div className="bg-card-gradient border border-amber-500/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setStaleOpen(!staleOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-card-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">
                {dashboard!.staleCount} tenant{dashboard!.staleCount !== 1 ? "s" : ""} with no notes in 30+ days
              </span>
            </div>
            {staleOpen ? <ChevronUp className="w-4 h-4 text-text-dim" /> : <ChevronDown className="w-4 h-4 text-text-dim" />}
          </button>
          {staleOpen && (
            <div className="px-4 pb-3 text-xs text-text-muted">
              <p>These tenants have outstanding balances but no recent follow-up activity.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="bg-card-gradient border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-dim uppercase tracking-wider">Building</label>
            <select
              value={filters.buildingId || ""}
              onChange={(e) => handleBuildingFilter(e.target.value)}
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent min-w-[180px]"
            >
              <option value="">All Buildings</option>
              {(buildings || []).map((b) => (
                <option key={b.id} value={b.id}>{b.address}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-dim uppercase tracking-wider">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent min-w-[140px]"
            >
              <option value="">All</option>
              <option value="LEGAL">In Legal</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-text-dim uppercase tracking-wider">Min Balance</label>
            <input
              type="number"
              value={minBalanceInput}
              onChange={(e) => setMinBalanceInput(e.target.value)}
              onBlur={applyMinBalance}
              onKeyDown={(e) => e.key === "Enter" && applyMinBalance()}
              placeholder="$0"
              className="bg-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent w-24"
            />
          </div>

          <span className="text-xs text-text-dim ml-auto">{tenantsData?.total ?? 0} tenants</span>
        </div>
      </div>

      {/* ── Tenant AR Table ── */}
      {rows.length > 0 ? (
        <div className="bg-card-gradient border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Tenant</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Building</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Unit</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-dim uppercase">Balance</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-text-dim uppercase">Aging</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-text-dim uppercase">Legal</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Last Note</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-dim uppercase">Note Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/collections/${row.id}`)}
                  className="border-b border-border/50 hover:bg-card-hover transition-colors cursor-pointer"
                >
                  <td className="px-3 py-2 text-text-primary">{row.name}</td>
                  <td className="px-3 py-2 text-text-muted text-xs">{row.buildingAddress}</td>
                  <td className="px-3 py-2 text-text-muted text-xs">{row.unitNumber}</td>
                  <td className="px-3 py-2 text-right text-red-400 font-mono">{fmt$(row.balance)}</td>
                  <td className="px-3 py-2 text-center"><AgingBadge category={row.arrearsCategory} /></td>
                  <td className="px-3 py-2 text-center">
                    {row.inLegal && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-purple-500/10 text-purple-400">LEGAL</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-dim text-xs max-w-[200px] truncate">{row.lastNoteText || "—"}</td>
                  <td className="px-3 py-2 text-text-dim text-xs">{row.lastNoteDate ? formatDate(row.lastNoteDate) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-text-dim">
                Page {page} of {totalPages} ({tenantsData!.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-xs px-3 py-1 rounded-lg border border-border text-text-muted hover:bg-card-hover disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="text-xs px-3 py-1 rounded-lg border border-border text-text-muted hover:bg-card-hover disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="No tenants in arrears"
          description="All tenants are current on their balances. Tenants with outstanding balances will appear here."
          icon={DollarSign}
        />
      )}
    </div>
  );
}
